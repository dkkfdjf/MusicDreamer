package com.musicdreamer.media.job;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.media.client.MusicClient;
import com.musicdreamer.media.entity.MediaTask;
import com.musicdreamer.media.exec.ExecResult;
import com.musicdreamer.media.exec.ProcessExecutor;
import com.musicdreamer.media.service.NetArgs;
import com.musicdreamer.media.service.SettingsService;
import com.musicdreamer.media.service.StorageService;
import com.musicdreamer.media.service.TaskManager;
import com.musicdreamer.media.tools.ToolsLocator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 响度分析（EBU R128）+ AI 转写 + 字幕下载（设计 10.6/10.7）。 */
@Slf4j
@Component
public class MediaJobs {

    private static final Pattern LUFS_MAIN = Pattern.compile(
            "Summary:[\\s\\S]*?Integrated loudness:[\\s\\S]*?I:\\s+(-?\\d+\\.?\\d*)\\s+LUFS");
    private static final Pattern LUFS_FALLBACK = Pattern.compile("I:\\s+(-?\\d+\\.?\\d*)\\s+LUFS");
    private static final Pattern WHISPER_PROGRESS = Pattern.compile("progress\\s*=\\s*(\\d+)%");

    private final TaskManager tasks;
    private final ProcessExecutor executor;
    private final ToolsLocator tools;
    private final StorageService storage;
    private final SettingsService settings;
    private final MusicClient music;
    private final NetArgs netArgs;

    public MediaJobs(TaskManager tasks, ProcessExecutor executor, ToolsLocator tools,
                     StorageService storage, SettingsService settings, MusicClient music,
                     NetArgs netArgs) {
        this.tasks = tasks;
        this.executor = executor;
        this.tools = tools;
        this.storage = storage;
        this.settings = settings;
        this.music = music;
        this.netArgs = netArgs;
        tasks.runnerLocator().register(TaskManager.LOUDNESS, this::loudness);
        tasks.runnerLocator().register(TaskManager.TRANSCRIBE, this::transcribe);
        tasks.runnerLocator().register(TaskManager.SUBTITLE, this::subtitle);
    }

    /** 响度分析：ffmpeg ebur128 结果在 stderr（约束三），增益=目标-实测，回写 song 表。 */
    public void loudness(MediaTask task) {
        Long songId = task.getSongId();
        String ffmpeg = tools.locate(ToolsLocator.FFMPEG);
        Map<String, Object> song = fetchSong(songId);
        Path file = storage.localPath((String) song.get("fileUrl"));
        if (ffmpeg == null || file == null || !Files.isRegularFile(file)) {
            tasks.finish(task.getId(), "FAILED", "音频文件或 ffmpeg 不可用");
            return;
        }
        tasks.progress(task.getId(), 20, "正在分析响度…");
        ExecResult r = executor.run(List.of(ffmpeg, "-i", file.toString(),
                        "-filter_complex", "ebur128", "-f", "null", "-"),
                10 * 60_000L, null, TaskManager.cancelKey(task.getId())).join();
        if (r.getExitCode() != 0) {
            tasks.finish(task.getId(), "FAILED", "响度分析失败：" + brief(r.getStderr()));
            return;
        }
        Double integrated = parseLufs(r.getStderr());
        if (integrated == null) {
            tasks.finish(task.getId(), "FAILED", "未能解析响度结果");
            return;
        }
        double gain = settings.volumeTargetLufs() - integrated;
        tasks.progress(task.getId(), 80, "正在回写增益 " + String.format("%.1f", gain) + " dB…");
        call(() -> music.updateLoudness(Map.of("songId", songId, "gain", gain, "integrated", integrated)));
        tasks.finish(task.getId(), "SUCCESS", null);
    }

    /** AI 转写：16kHz 单声道 WAV -> whisper LRC -> 回写歌词；模型缺失走降级提示（F042-1）。 */
    public void transcribe(MediaTask task) {
        Long songId = task.getSongId();
        String ffmpeg = tools.locate(ToolsLocator.FFMPEG);
        String whisper = tools.locate(ToolsLocator.WHISPER);
        Path model = findModel(settings.whisperModel());
        if (whisper == null || model == null) {
            tasks.finish(task.getId(), "FAILED", "请先在管理端-模型管理中下载 whisper 模型并安装 whisper-cli");
            return;
        }
        Map<String, Object> song = fetchSong(songId);
        Path mp3 = storage.localPath((String) song.get("fileUrl"));
        if (mp3 == null || !Files.isRegularFile(mp3)) {
            tasks.finish(task.getId(), "FAILED", "音频文件不可用");
            return;
        }
        Path taskDir = storage.dir("task");
        Path wav = taskDir.resolve(task.getId() + "_temp.wav");
        try {
            tasks.progress(task.getId(), 10, "预处理音频…");
            ExecResult pre = executor.run(List.of(ffmpeg, "-y", "-i", mp3.toString(),
                            "-ar", "16000", "-ac", "1", wav.toString()),
                    5 * 60_000L, null, TaskManager.cancelKey(task.getId())).get();
            if (pre.getExitCode() != 0) {
                tasks.finish(task.getId(), "FAILED", "音频预处理失败");
                return;
            }
            Path outPrefix = taskDir.resolve(String.valueOf(task.getId()));
            tasks.progress(task.getId(), 20, "AI 识别中…");
            ExecResult tr = executor.run(List.of(whisper,
                            "-m", model.toString(), "-f", wav.toString(),
                            "-l", "auto", "-olrc", "-of", outPrefix.toString(), "-pp"),
                    30 * 60_000L,
                    line -> {
                        Matcher m = WHISPER_PROGRESS.matcher(line);
                        if (m.find()) {
                            tasks.progress(task.getId(), 20 + Integer.parseInt(m.group(1)) * 7 / 10,
                                    "AI 识别中… " + m.group(1) + "%");
                        }
                    }, TaskManager.cancelKey(task.getId())).getNow(null);
            if (tr == null || tr.getExitCode() != 0) {
                tasks.finish(task.getId(), "FAILED", "转写失败：" + brief(tr.getStderr()));
                return;
            }
            Path lrc = taskDir.resolve(task.getId() + ".lrc");
            if (!Files.isRegularFile(lrc)) {
                tasks.finish(task.getId(), "FAILED", "未生成歌词产物");
                return;
            }
            Path finalLrc = storage.dir("lyric").resolve(songId + ".lrc");
            Files.move(lrc, finalLrc, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            tasks.progress(task.getId(), 90, "回写歌词…");
            call(() -> music.updateLyric(Map.of("songId", songId,
                    "lyricUrl", storage.fileUrl("lyric", songId + ".lrc"))));
            tasks.finish(task.getId(), "SUCCESS", null);
        } catch (Exception e) {
            tasks.finish(task.getId(), "FAILED", "转写异常：" + e.getMessage());
        } finally {
            try {
                Files.deleteIfExists(wav);
                Files.deleteIfExists(taskDir.resolve(task.getId() + ".lrc"));
            } catch (Exception ignored) {
            }
        }
    }

    /** 字幕下载：仅拉字幕轨；无字幕静默成功（不算失败）。 */
    public void subtitle(MediaTask task) {
        String url = task.getSourceUrl();
        String ytdlp = tools.locate(ToolsLocator.YT_DLP);
        if (ytdlp == null || url == null) {
            tasks.finish(task.getId(), "FAILED", "yt-dlp 不可用或来源缺失");
            return;
        }
        Path taskDir = storage.dir("task");
        String out = taskDir.resolve(task.getId() + "_sub").toString();
        tasks.progress(task.getId(), 30, "正在下载字幕…");
        List<String> cmd = new ArrayList<>(List.of(ytdlp, "--write-subs", "--skip-download",
                "--sub-lang", "zh-Hans,zh,en", "-o", out));
        cmd.addAll(netArgs.build(url));
        ExecResult r = executor.run(cmd, 5 * 60_000L, null, TaskManager.cancelKey(task.getId())).join();
        if (r.getExitCode() != 0) {
            tasks.finish(task.getId(), "FAILED", "字幕下载失败：" + brief(r.getStderr()));
            return;
        }
        Path srt = findSubtitle(taskDir, task.getId());
        if (srt == null) {
            tasks.finish(task.getId(), "SUCCESS", null); // 无字幕：静默成功
            return;
        }
        String lrcText = SrtToLrc.convert(srt);
        try {
            Path finalLrc = storage.dir("lyric").resolve(task.getSongId() + ".lrc");
            Files.writeString(finalLrc, lrcText == null ? "" : lrcText);
            if (task.getSongId() != null) {
                call(() -> music.updateLyric(Map.of("songId", task.getSongId(),
                        "lyricUrl", storage.fileUrl("lyric", task.getSongId() + ".lrc"))));
            }
            tasks.finish(task.getId(), "SUCCESS", null);
        } catch (Exception e) {
            tasks.finish(task.getId(), "FAILED", "字幕入库失败：" + e.getMessage());
        } finally {
            try {
                Files.deleteIfExists(srt);
            } catch (Exception ignored) {
            }
        }
    }

    // ---------- 私有 ----------

    private Map<String, Object> fetchSong(Long songId) {
        if (songId == null) {
            throw new IllegalStateException("任务缺少 songId");
        }
        Mess m = music.findById(songId);
        if (m != null && m.isOk() && m.getData() instanceof Map<?, ?> raw) {
            Map<String, Object> song = new java.util.HashMap<>();
            raw.forEach((k, v) -> song.put(String.valueOf(k), v));
            return song;
        }
        throw new IllegalStateException("歌曲不存在（id=" + songId + "）");
    }

    private Path findModel(String spec) {
        for (String name : new String[]{"ggml-" + spec + ".bin", "ggml-" + spec + ".q5_1.bin"}) {
            Path p = storage.modelsDir().resolve(name);
            if (Files.isRegularFile(p)) {
                return p;
            }
        }
        return null;
    }

    private Path findSubtitle(Path dir, int taskId) {
        for (String suffix : new String[]{".zh-Hans.srt", ".zh.srt", ".en.srt", ".srt",
                ".zh-Hans.vtt", ".zh.vtt", ".vtt"}) {
            Path p = dir.resolve(taskId + "_sub" + suffix);
            if (Files.isRegularFile(p)) {
                return p;
            }
        }
        try (var stream = Files.newDirectoryStream(dir, taskId + "_sub*")) {
            for (Path p : stream) {
                return p;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private Double parseLufs(String stderr) {
        Matcher m = LUFS_MAIN.matcher(stderr);
        if (m.find()) {
            return Double.parseDouble(m.group(1));
        }
        m = LUFS_FALLBACK.matcher(stderr);
        if (m.find()) {
            return Double.parseDouble(m.group(1));
        }
        return null;
    }

    private void call(Runnable r) {
        try {
            r.run();
        } catch (Exception e) {
            log.warn("feign callback degraded: {}", e.getMessage());
        }
    }

    private String brief(String s) {
        if (s == null) return "";
        String line = s.lines().filter(l -> !l.isBlank()).reduce((a, b) -> b).orElse("");
        return line.length() > 120 ? line.substring(0, 120) : line;
    }
}
