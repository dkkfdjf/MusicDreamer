package com.musicdreamer.media.controller;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.media.entity.MediaTask;
import com.musicdreamer.media.service.SettingsService;
import com.musicdreamer.media.service.StorageService;
import com.musicdreamer.media.service.TaskManager;
import com.musicdreamer.media.tools.ToolsLocator;
import com.musicdreamer.media.tools.ToolsMgmtJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 工具与模型管理 API（设计 10.3/10.8，管理员）。 */
@Slf4j
@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class ToolsController {

    private final ToolsLocator tools;
    private final TaskManager tasks;
    private final SettingsService settings;
    private final StorageService storage;
    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(10)).build();

    private static final List<Map<String, String>> MODELS = List.of(
            Map.of("key", "tiny", "label", "试水", "sizeText", "约75MB"),
            Map.of("key", "base", "label", "默认推荐", "sizeText", "约142MB"),
            Map.of("key", "small", "label", "高精度", "sizeText", "约466MB"),
            Map.of("key", "medium", "label", "最高精度（很慢）", "sizeText", "约1.5GB"));

    /** 探测缓存：起 4 个进程 + 访问 GitHub 太重，结果缓存 5 分钟让管理后台秒开。 */
    private volatile List<Map<String, Object>> statusCache;
    private volatile long statusCacheAt;
    private volatile String latestCache;
    private volatile long latestCacheAt;

    @GetMapping("/tools/status")
    public Mess toolsStatus() {
        AuthContext.requireAdmin();
        long now = System.currentTimeMillis();
        if (statusCache != null && now - statusCacheAt < 300_000) {
            return Mess.ok(statusCache);
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (String tool : List.of(ToolsLocator.YT_DLP, ToolsLocator.FFMPEG,
                ToolsLocator.FFPROBE, ToolsLocator.WHISPER)) {
            String path = tools.locate(tool);
            String version = null;
            if (path != null) {
                version = tools.execVersion(path, tools.probeArgs(tool));
                // whisper-cli 的 --help 首行是 usage:，构建无版本号时给友好文案
                if (version != null && (version.startsWith("usage:") || version.startsWith("error:"))) {
                    version = "已安装（该构建无版本号）";
                }
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", tool);
            item.put("path", path);
            item.put("version", version);
            item.put("alive", version != null);
            item.put("latest", tool.equals(ToolsLocator.YT_DLP) ? githubLatest() : null);
            list.add(item);
        }
        statusCache = list;
        statusCacheAt = now;
        return Mess.ok(list);
    }

    @PostMapping("/tools/update-ytdlp")
    public Mess updateYtdlp() {
        AuthContext.requireAdmin();
        MediaTask t = tasks.submit(TaskManager.TOOL_UPDATE, null, null,
                AuthContext.getUserId(), "准备更新 yt-dlp…");
        return Mess.ok(Map.of("taskId", t.getId()));
    }

    @GetMapping("/models")
    public Mess models() {
        AuthContext.requireLogin();
        String current = settings.whisperModel();
        Path dir = storage.modelsDir();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, String> m : MODELS) {
            String key = m.get("key");
            Map<String, Object> item = new LinkedHashMap<>(m);
            // 使用中 = 当前选中且文件真实存在，避免"使用中却带下载按钮"的矛盾态
            boolean downloaded = Files.isRegularFile(dir.resolve("ggml-" + key + ".bin"));
            item.put("downloaded", downloaded);
            item.put("isCurrent", key.equals(current) && downloaded);
            list.add(item);
        }
        return Mess.ok(list);
    }

    @PostMapping("/models/{key}/download")
    public Mess modelDownload(@PathVariable String key) {
        AuthContext.requireAdmin();
        if (MODELS.stream().noneMatch(m -> m.get("key").equals(key))) {
            return Mess.fail(5003, "未知模型规格");
        }
        MediaTask t = tasks.submit(TaskManager.MODEL_DOWNLOAD, null, null,
                AuthContext.getUserId(), "下载模型 " + key);
        return Mess.ok(Map.of("taskId", t.getId()));
    }

    @PostMapping("/models/{key}/use")
    public Mess modelUse(@PathVariable String key) {
        AuthContext.requireAdmin();
        if (MODELS.stream().noneMatch(m -> m.get("key").equals(key))) {
            return Mess.fail(5003, "未知模型规格");
        }
        if (!Files.isRegularFile(storage.modelsDir().resolve("ggml-" + key + ".bin"))) {
            return Mess.fail(5003, "模型尚未下载，请先下载再切换");
        }
        try {
            Path marker = storage.modelsDir().resolve("current.txt");
            Files.writeString(marker, key);
        } catch (Exception e) {
            log.warn("current model marker write failed: {}", e.getMessage());
        }
        return Mess.ok(Map.of("key", key));
    }

    @PostMapping("/models/{key}/delete")
    public Mess modelDelete(@PathVariable String key) {
        AuthContext.requireAdmin();
        if (key.equals(settings.whisperModel())) {
            return Mess.fail(2007, "当前使用中的模型不允许删除");
        }
        try {
            Files.deleteIfExists(storage.modelsDir().resolve("ggml-" + key + ".bin"));
        } catch (Exception e) {
            return Mess.fail(1000, "删除失败：" + e.getMessage());
        }
        return Mess.ok();
    }

    /** GitHub 最新版比对（yt-dlp 版本号即日期）。成功缓存 1 小时；国内访问常超时，失败 10 分钟内不重试。 */
    private String githubLatest() {
        long now = System.currentTimeMillis();
        if (latestCacheAt > 0
                && now - latestCacheAt < (latestCache == null ? 600_000 : 3_600_000)) {
            return latestCache;
        }
        try {
            HttpRequest req = HttpRequest.newBuilder(
                            URI.create("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest"))
                    .header(HttpHeaders.USER_AGENT, "MusicDreamer-Updater")
                    .header(HttpHeaders.ACCEPT, "application/vnd.github+json")
                    .timeout(Duration.ofSeconds(3)).build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            String body = resp.body();
            int i = body.indexOf("\"tag_name\"");
            if (i >= 0) {
                int s = body.indexOf('"', i + 11) + 1;
                int e = body.indexOf('"', s);
                latestCache = body.substring(s, e);
                latestCacheAt = now;
                return latestCache;
            }
        } catch (Exception e) {
            log.warn("github latest check failed: {}", e.getMessage());
        }
        latestCacheAt = now;
        return latestCache;
    }
}
