package com.musicdreamer.media.tools;

import com.musicdreamer.media.exec.ExecResult;
import com.musicdreamer.media.exec.ProcessExecutor;
import com.musicdreamer.media.service.SettingsService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 工具定位器（设计 10.3）：tools_path 配置 -> 项目 tools 目录 -> 系统 PATH。
 * 启动自检：逐工具 --version（5 秒超时），健康状态暴露 media_tool_alive{tool}。
 */
@Slf4j
@Component
public class ToolsLocator {

    public static final String YT_DLP = "yt-dlp";
    public static final String FFMPEG = "ffmpeg";
    public static final String FFPROBE = "ffprobe";
    public static final String WHISPER = "whisper";
    public static final String OCR = "ocr";

    private final SettingsService settings;
    private final ProcessExecutor executor;
    private final MeterRegistry registry;
    private final Map<String, String> cached = new ConcurrentHashMap<>();

    public ToolsLocator(SettingsService settings, ProcessExecutor executor, MeterRegistry registry) {
        this.settings = settings;
        this.executor = executor;
        this.registry = registry;
    }

    /** 按逻辑名定位可执行文件绝对路径；找不到返回 null。 */
    public String locate(String tool) {
        if (cached.containsKey(tool)) {
            return cached.get(tool);
        }
        String found = probe(tool);
        cached.put(tool, found);
        return found;
    }

    private String probe(String tool) {
        List<Path> dirs = new ArrayList<>();
        String conf = settings.toolsPath();
        if (conf != null && !conf.isBlank()) {
            dirs.add(Paths.get(conf).toAbsolutePath().normalize());
        }
        dirs.add(Paths.get("tools").toAbsolutePath().normalize());
        dirs.add(Paths.get("../tools").toAbsolutePath().normalize());
        // ffmpeg 在 tools/ffmpeg/bin 下；whisper 在 tools/whisper 下
        List<String> names = candidates(tool);
        for (Path dir : dirs) {
            for (String sub : new String[]{"", "bin/", "ffmpeg/bin/", "whisper/"}) {
                for (String name : names) {
                    Path p = dir.resolve(sub + name);
                    if (Files.isRegularFile(p)) {
                        return p.toString();
                    }
                }
            }
        }
        // PATH 兜底（ProcessBuilder 直接用名字解析）
        for (String name : names) {
            if (execVersion(name) != null) {
                return name;
            }
        }
        return null;
    }

    private List<String> candidates(String tool) {
        boolean win = System.getProperty("os.name", "").toLowerCase().contains("win");
        return switch (tool) {
            case YT_DLP -> win ? List.of("yt-dlp.exe", "yt-dlp") : List.of("yt-dlp");
            case FFMPEG -> win ? List.of("ffmpeg.exe", "ffmpeg") : List.of("ffmpeg");
            case FFPROBE -> win ? List.of("ffprobe.exe", "ffprobe") : List.of("ffprobe");
            case WHISPER -> win ? List.of("whisper-cli.exe", "whisper.exe")
                    : List.of("whisper-cli", "whisper");
            case OCR -> List.of("ocr.ps1");
            default -> List.of(tool);
        };
    }

    /** 各工具取版本号的探测参数（whisper-cli 不支持 --version，用 --help 探活）。 */
    public List<String> probeArgs(String tool) {
        return switch (tool) {
            case FFMPEG, FFPROBE -> List.of("-version");
            case WHISPER -> List.of("--help");
            default -> List.of("--version");
        };
    }

    /** 执行取首行；失败返回 null。 */
    public String execVersion(String executable) {
        return execVersion(executable, List.of("--version"));
    }

    public String execVersion(String executable, List<String> args) {
        try {
            List<String> cmd = new ArrayList<>(List.of(executable));
            cmd.addAll(args);
            ExecResult r = executor.run(cmd,
                    5000, null, "selfcheck-" + executable).get(6, TimeUnit.SECONDS);
            if (r != null && r.getExitCode() == 0) {
                String out = r.getStdout().isBlank() ? r.getStderr() : r.getStdout();
                return out.lines().findFirst().orElse(null);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /** 启动自检：写健康 Gauge，返回 工具->是否健康。 */
    public Map<String, Boolean> selfCheck() {
        Map<String, Boolean> result = new java.util.LinkedHashMap<>();
        for (String tool : List.of(YT_DLP, FFMPEG, FFPROBE, WHISPER)) {
            String path = locate(tool);
            boolean alive = path != null && execVersion(path, probeArgs(tool)) != null;
            result.put(tool, alive);
            registry.gauge("media_tool_alive", Tag.of("tool", tool),
                    live -> alive ? 1 : 0);
            log.info("tool self-check {} -> path={} alive={}", tool, path, alive);
        }
        return result;
    }

    public void invalidate() {
        cached.clear();
    }
}
