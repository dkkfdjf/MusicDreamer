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
        tasks.runnerLocator().register(TaskManager.LYRICS_FETCH, this::lyricsFetch);
    }

    /**
     * 一键获取歌词：在线歌词库（LRCLIB）优先 → 命中同步歌词则逐句校准到本地
     * 演唱时刻（B站搬运版常有剪辑/偏移）；命中纯文本则用本地识别拆句加时间轴
     * （文本用在线的、拆句与时间用本地的）；未命中则本地 AI 转写。
     */
    public void lyricsFetch(MediaTask task) {
        Long songId = task.getSongId();
        Map<String, Object> song = fetchSong(songId);
        String title = String.valueOf(song.getOrDefault("name", ""));
        String artist = String.valueOf(song.getOrDefault("singerName", ""));
        double duration = song.get("duration") instanceof Number n ? n.doubleValue() : 0;

        // 1) 在线匹配（网络失败静默降级到本地识别）
        tasks.progress(task.getId(), 10, "正在匹配在线歌词库…");
        LrcSupport.OnlineMatch m = null;
        try {
            m = LrcSupport.matchOnlineLyrics(title, artist, duration);
        } catch (Exception e) {
            log.warn("lrclib match degraded: {}", e.getMessage());
        }

        try {
            if (m != null && m.syncedLyrics() != null) {
                tasks.progress(task.getId(), 25, "已命中在线歌词，正在本地校准时间轴…");
                List<LrcSupport.LrcLine> lrc = LrcSupport.parseLrc(m.syncedLyrics());
                List<LrcSupport.LrcLine> wav = transcribeForAlign(task, song);
                LyricAligner.Aligned aligned = wav == null ? null
                        : LyricAligner.computeAlignedTimes(lrc, wav, duration > 0 ? duration : null);
                String content;
                String note;
                if (aligned != null) {
                    content = LyricAligner.writeAlignedLyrics(m.syncedLyrics(), aligned.times(), aligned.median());
                    note = String.format("已逐句校准 %d/%d 句（整体偏移 %.1fs）", aligned.pairs(), lrc.size(), aligned.median());
                } else {
                    content = m.syncedLyrics();
                    note = wav == null ? "本地校准不可用，保留在线时间轴" : "本地校准未完成，保留在线时间轴";
                }
                saveLyric(songId, "[source:lrclib]\n" + content);
                tasks.finish(task.getId(), "SUCCESS", note + "（" + m.trackName() + "）");
                return;
            }

            if (m != null && m.plainLyrics() != null) {
                tasks.progress(task.getId(), 25, "在线歌词无时间轴，正在用本地识别添加…");
                List<LrcSupport.LrcLine> plain = LrcSupport.parseLrc(m.plainLyrics());
                List<LrcSupport.LrcLine> wav = transcribeForAlign(task, song);
                if (wav != null) {
                    LyricAligner.Merged merged = LyricAligner.mergePlainWithWav(plain, wav);
                    int need = Math.max(3, (int) Math.ceil(plain.size() * 0.25));
                    if (merged.matched() >= need) {
                        String splitNote = merged.lines().size() > plain.size()
                                ? String.format("，已按演唱拆分为 %d 行", merged.lines().size()) : "";
                        saveLyric(songId, "[source:lrclib]\n" + LyricAligner.writeMergedLyrics(merged.lines()));
                        tasks.finish(task.getId(), "SUCCESS",
                                String.format("已用本地识别添加时间轴（%d/%d 句对齐%s）（%s）",
                                        merged.matched(), plain.size(), splitNote, m.trackName()));
                        return;
                    }
                    // 对不上：宁可保留纯文本，不写错误时间轴
                    saveLyric(songId, "[source:lrclib]\n" + m.plainLyrics());
                    tasks.finish(task.getId(), "SUCCESS",
                            String.format("在线歌词与本地识别对不上（%d/%d 句），保留纯文本（%s）",
                                    merged.matched(), plain.size(), m.trackName()));
                    return;
                }
                saveLyric(songId, "[source:lrclib]\n" + m.plainLyrics());
                tasks.finish(task.getId(), "SUCCESS", "已保存在线纯文本歌词（本地识别不可用，无时间轴）（" + m.trackName() + "）");
                return;
            }

            // 2) 在线无命中 → 本地 AI 转写
            tasks.progress(task.getId(), 25, "在线无歌词，本地 AI 识别中…");
            transcribe(task);
        } catch (Exception e) {
            tasks.finish(task.getId(), "FAILED", "获取歌词异常：" + e.getMessage());
        }
    }

    /** 为对齐/加时间轴跑一次快速整首转写，返回解析后的歌词行；失败返回 null。 */
    private List<LrcSupport.LrcLine> transcribeForAlign(MediaTask task, Map<String, Object> song) {
        Long songId = task.getSongId();
        String ffmpeg = tools.locate(ToolsLocator.FFMPEG);
        String whisper = tools.locate(ToolsLocator.WHISPER);
        Path model = findModel(settings.whisperModel());
        if (whisper == null || model == null) return null;
        Path mp3 = storage.localPath((String) song.get("fileUrl"));
        if (mp3 == null || !Files.isRegularFile(mp3)) return null;
        Path taskDir = storage.dir("task");
        Path wav = taskDir.resolve(task.getId() + "_align.wav");
        Path outPrefix = taskDir.resolve(task.getId() + "_align");
        try {
            // 清掉可能残留的上次产物，防止 whisper 失败时读到陈旧 LRC
            Files.deleteIfExists(taskDir.resolve(task.getId() + "_align.lrc"));
            ExecResult pre = executor.run(List.of(ffmpeg, "-y", "-i", mp3.toString(),
                            "-ar", "16000", "-ac", "1", wav.toString()),
                    5 * 60_000L, null, TaskManager.cancelKey(task.getId())).get();
            if (pre.getExitCode() != 0) return null;
            // -ml 40 控制单行长度（按句切分）、束搜索 + 零温度提升稳定性
            ExecResult tr = executor.run(List.of(whisper, "-m", model.toString(), "-f", wav.toString(),
                            "-l", "auto", "-bs", "5", "-bo", "5", "-tp", "0", "-ml", "40",
                            "-olrc", "-of", outPrefix.toString(), "-pp"),
                    30 * 60_000L,
                    line -> {
                        Matcher pm = WHISPER_PROGRESS.matcher(line);
                        if (pm.find()) {
                            tasks.progress(task.getId(),
                                    25 + Integer.parseInt(pm.group(1)) * 6 / 10, "本地快转写中… " + pm.group(1) + "%");
                        }
                    }, TaskManager.cancelKey(task.getId())).getNow(null);
            if (tr == null || tr.getExitCode() != 0) return null;
            Path lrc = taskDir.resolve(task.getId() + "_align.lrc");
            if (!Files.isRegularFile(lrc)) return null;
            return LrcSupport.parseLrc(Files.readString(lrc));
        } catch (Exception e) {
            log.warn("align transcribe degraded: {}", e.getMessage());
            return null;
        } finally {
            try {
                Files.deleteIfExists(wav);
                Files.deleteIfExists(taskDir.resolve(task.getId() + "_align.lrc"));
            } catch (Exception ignored) {
            }
        }
    }

    /** 保存歌词文件到 data/lyric/{songId}.lrc 并回写 song.lyric_url。 */
    private void saveLyric(Long songId, String content) throws Exception {
        Path finalLrc = storage.dir("lyric").resolve(songId + ".lrc");
        Files.writeString(finalLrc, content == null ? "" : content);
        call(() -> music.updateLyric(Map.of("songId", songId,
                "lyricUrl", storage.fileUrl("lyric", songId + ".lrc"))));
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
