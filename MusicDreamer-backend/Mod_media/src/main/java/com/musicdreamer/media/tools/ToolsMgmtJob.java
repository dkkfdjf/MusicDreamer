package com.musicdreamer.media.tools;

import com.musicdreamer.media.entity.MediaTask;
import com.musicdreamer.media.exec.ProcessExecutor;
import com.musicdreamer.media.service.StorageService;
import com.musicdreamer.media.service.TaskManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.List;

/** TOOL_UPDATE 与 MODEL_DOWNLOAD 任务（设计 10.3）：.part 流式 + 体积校验 + 原子替换。 */
@Slf4j
@Component
public class ToolsMgmtJob {

    private final TaskManager tasks;
    private final ProcessExecutor executor;
    private final ToolsLocator toolsLocator;
    private final StorageService storage;
    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(15)).build();

    public ToolsMgmtJob(TaskManager tasks, ProcessExecutor executor,
                        ToolsLocator toolsLocator, StorageService storage) {
        this.tasks = tasks;
        this.executor = executor;
        this.toolsLocator = toolsLocator;
        this.storage = storage;
        tasks.runnerLocator().register(TaskManager.TOOL_UPDATE, this::toolUpdate);
        tasks.runnerLocator().register(TaskManager.MODEL_DOWNLOAD, this::modelDownload);
    }

    /** yt-dlp 自动更新：下载 .part（失败切镜像）-> >5MB 校验 -> 原子替换 -> --version 验证（失败回滚）。 */
    public void toolUpdate(MediaTask task) {
        boolean win = System.getProperty("os.name", "").toLowerCase().contains("win");
        String asset = win ? "yt-dlp.exe" : "yt-dlp_linux";
        String base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/" + asset;
        List<String> urls = List.of(base, "https://ghproxy.com/" + base);
        Path toolsDir = toolsDir();
        Path target = toolsDir.resolve(win ? "yt-dlp.exe" : "yt-dlp");
        try {
            tasks.progress(task.getId(), 10, "正在下载最新 yt-dlp…");
            if (!downloadAny(urls, toolsDir.resolve(asset + ".new.part"), 5_000_000, task.getId(), 10, 80)) {
                tasks.finish(task.getId(), "FAILED", "下载失败（直链与镜像均不可用）");
                return;
            }
            tasks.progress(task.getId(), 82, "校验并替换…");
            Path part = toolsDir.resolve(asset + ".new.part");
            Path bak = toolsDir.resolve(target.getFileName() + ".bak");
            Files.deleteIfExists(bak);
            if (Files.exists(target)) {
                Files.move(target, bak, StandardCopyOption.REPLACE_EXISTING);
            }
            Files.move(part, target, StandardCopyOption.REPLACE_EXISTING);
            String version = toolsLocator.execVersion(target.toString());
            if (version == null) {
                Files.deleteIfExists(target);
                if (Files.exists(bak)) {
                    Files.move(bak, target, StandardCopyOption.REPLACE_EXISTING);
                }
                tasks.finish(task.getId(), "FAILED", "新版本验证失败，已回滚");
                return;
            }
            Files.deleteIfExists(bak);
            toolsLocator.invalidate();
            tasks.finish(task.getId(), "SUCCESS", null);
            log.info("yt-dlp updated to {}", version);
        } catch (Exception e) {
            tasks.finish(task.getId(), "FAILED", "更新失败：" + e.getMessage());
        }
    }

    /** whisper 模型下载：hf-mirror 优先、huggingface 兜底、>1MB 校验。 */
    public void modelDownload(MediaTask task) {
        String key = task.getStage() == null ? "base" : task.getStage().replace("下载模型 ", "");
        String base = "https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-" + key + ".bin";
        List<String> urls = List.of(base,
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-" + key + ".bin");
        Path dir = storage.modelsDir();
        Path part = dir.resolve("ggml-" + key + ".bin.part");
        try {
            tasks.progress(task.getId(), 5, "正在下载模型 " + key + "…");
            if (!downloadAny(urls, part, 1_000_000, task.getId(), 5, 95)) {
                tasks.finish(task.getId(), "FAILED", "模型下载失败（镜像与官方源均不可用）");
                return;
            }
            Files.move(part, dir.resolve("ggml-" + key + ".bin"), StandardCopyOption.REPLACE_EXISTING);
            tasks.finish(task.getId(), "SUCCESS", null);
        } catch (Exception e) {
            tasks.finish(task.getId(), "FAILED", "模型下载失败：" + e.getMessage());
        }
    }

    private boolean downloadAny(List<String> urls, Path dest, long minBytes,
                                int taskId, int fromPct, int toPct) throws Exception {
        for (String url : urls) {
            try {
                HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                        .header("User-Agent", "MusicDreamer-Updater")
                        .timeout(Duration.ofMinutes(30)).build();
                HttpResponse<InputStream> resp = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
                if (resp.statusCode() != 200) {
                    continue;
                }
                long total = resp.headers().firstValueAsLong("Content-Length").orElse(0);
                long done = 0;
                try (InputStream in = resp.body()) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    long lastTick = 0;
                    try (var out = Files.newOutputStream(dest)) {
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            done += n;
                            long now = System.currentTimeMillis();
                            if (total > 0 && now - lastTick > 500) {
                                lastTick = now;
                                int pct = (int) (fromPct + done * (toPct - fromPct) / total);
                                tasks.progress(taskId, pct, "下载中… " + pct + "%");
                            }
                        }
                    }
                }
                if (done < minBytes) {
                    Files.deleteIfExists(dest);
                    continue;
                }
                return true;
            } catch (Exception e) {
                log.warn("download source failed {}: {}", url, e.getMessage());
                Files.deleteIfExists(dest);
            }
        }
        return false;
    }

    private Path toolsDir() {
        for (String cand : new String[]{"tools", "../tools"}) {
            Path p = Paths.get(cand).toAbsolutePath().normalize();
            if (Files.isDirectory(p)) {
                return p;
            }
        }
        try {
            return Files.createDirectories(Paths.get("tools").toAbsolutePath().normalize());
        } catch (Exception e) {
            throw new IllegalStateException("无法创建 tools 目录", e);
        }
    }
}
