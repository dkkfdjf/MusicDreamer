package com.musicdreamer.media.controller;

import com.musicdreamer.common.api.ErrorCode;
import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.common.exception.BizException;
import com.musicdreamer.media.entity.MediaTask;
import com.musicdreamer.media.exec.ExecResult;
import com.musicdreamer.media.exec.ProcessExecutor;
import com.musicdreamer.media.service.StorageService;
import com.musicdreamer.media.service.TaskManager;
import com.musicdreamer.media.tools.ToolsLocator;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** 媒体任务 API（设计 10.8）：提交（role>=1）、查询、取消、转写、响度。 */
@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class MediaController {

    /** URL 识别正则族（设计 10.4）：B 站 / YouTube。 */
    private static final Pattern SUPPORTED = Pattern.compile(
            "(bilibili\\.com|m\\.bilibili\\.com|b23\\.tv|BV[0-9A-Za-z]{10}|av\\d+"
                    + "|youtube\\.com/watch|youtu\\.be/|youtube\\.com/shorts/|music\\.youtube\\.com|youtube\\.com/live/)",
            Pattern.CASE_INSENSITIVE);

    private final TaskManager tasks;
    private final StorageService storage;
    private final ToolsLocator tools;
    private final ProcessExecutor executor;

    @Data
    public static class DownloadDTO {
        private String url;
        private Boolean wantSubtitle = true;
        private Boolean wantTranscribe = false;
    }

    @PostMapping("/download")
    public Mess download(@RequestBody DownloadDTO dto) {
        AuthContext.requireUploader();
        if (dto.getUrl() == null || dto.getUrl().isBlank()) {
            throw new BizException(ErrorCode.PARAM_MISSING);
        }
        String url = extractUrl(dto.getUrl());
        if (!SUPPORTED.matcher(url).find()) {
            throw new BizException(ErrorCode.FILE_TYPE_UNSUPPORTED.getCode(), "不支持的链接");
        }
        MediaTask t = tasks.submit(TaskManager.DOWNLOAD, url, null,
                AuthContext.getUserId(), "排队中…");
        Map<String, Object> data = new HashMap<>();
        data.put("taskId", t.getId());
        data.put("estimatedTime", "1-5 分钟");
        return Mess.ok(data);
    }

    /** 从粘贴文本提取链接：B 站分享文案是“标题 链接 备注”，定位 http/www 起始截取，去尾部标点。 */
    static String extractUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("链接不能为空");
        }
        String s = raw.trim();
        int start = indexOfUrlStart(s);
        if (start < 0) {
            return s; // 无协议头按整段处理，交给 SUPPORTED 校验报错
        }
        String u = s.substring(start);
        int end = u.length();
        for (int i = 0; i < u.length(); i++) {
            char c = u.charAt(i);
            if (Character.isWhitespace(c) || c >= 0x4E00 && c <= 0x9FFF) {
                end = i;
                break;
            }
        }
        u = u.substring(0, end);
        while (!u.isEmpty() && "，。！？；、,.!?)）]】>\"'".indexOf(u.charAt(u.length() - 1)) >= 0) {
            u = u.substring(0, u.length() - 1);
        }
        return u;
    }

    private static int indexOfUrlStart(String s) {
        int best = -1;
        for (String head : new String[]{"http://", "https://", "www."}) {
            int i = s.indexOf(head);
            if (i >= 0 && (best < 0 || i < best)) {
                best = i;
            }
        }
        return best;
    }

    /** 图片 OCR（Windows 内置 WinRT 引擎，powershell 调 ocr.ps1）：识别歌词截图等，返回文本。 */
    @PostMapping("/ocr")
    public Mess ocr(@RequestBody Map<String, String> body) {
        AuthContext.requireUploader();
        String imageUrl = body.get("imageUrl");
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new BizException(ErrorCode.PARAM_MISSING);
        }
        Path img = storage.localPath(imageUrl);
        if (img == null || !Files.isRegularFile(img)) {
            throw new BizException(2001, "图片文件不存在");
        }
        String script = tools.locate(ToolsLocator.OCR);
        if (script == null) {
            throw new BizException(2002, "ocr.ps1 未安装（tools/bin）");
        }
        try {
            ExecResult r = executor.run(List.of("powershell.exe", "-NoProfile", "-ExecutionPolicy",
                            "Bypass", "-File", script, img.toString()),
                    60_000, null, "ocr-" + img.getFileName()).get(90, TimeUnit.SECONDS);
            if (r == null || r.getExitCode() != 0) {
                String err = r == null ? "执行超时"
                        : (r.getStderr() + r.getStdout()).lines().findFirst().orElse("未知原因");
                throw new BizException(2002, "识别失败：" + err);
            }
            // WinRT 中文识别会在汉字间插空格，去掉 CJK 之间的空白（保留英文词间距）
            String text = r.getStdout().trim().replaceAll("(?<=[一-龥])[ ]+(?=[一-龥])", "");
            return Mess.ok(Map.of("text", text));
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException(2002, "识别失败：" + e.getMessage());
        }
    }

    @GetMapping("/task/{id}")
    public Mess task(@PathVariable Integer id) {
        AuthContext.requireLogin();
        MediaTask t = tasks.get(id);
        Map<String, Object> data = new HashMap<>();
        data.put("taskId", t.getId());
        data.put("status", t.getStatus());
        data.put("progress", t.getProgress());
        data.put("stage", t.getStage());
        data.put("musicId", t.getSongId());
        data.put("error", t.getError());
        return Mess.ok(data);
    }

    @PostMapping("/task/{id}/cancel")
    public Mess cancel(@PathVariable Integer id) {
        AuthContext.requireLogin();
        boolean cancelled = tasks.cancel(id);
        return Mess.ok(Map.of("cancelled", cancelled));
    }

    @PostMapping("/transcribe/{songId}")
    public Mess transcribe(@PathVariable Long songId) {
        AuthContext.requireUploader();
        MediaTask t = tasks.submit(TaskManager.TRANSCRIBE, null, songId,
                AuthContext.getUserId(), "AI 转写排队");
        return Mess.ok(Map.of("taskId", t.getId()));
    }

    /** 一键获取歌词：在线歌词库优先（自动校准/加时间轴），无命中本地 AI 转写。 */
    @PostMapping("/lyrics/fetch/{songId}")
    public Mess lyricsFetch(@PathVariable Long songId) {
        AuthContext.requireUploader();
        MediaTask t = tasks.submit(TaskManager.LYRICS_FETCH, null, songId,
                AuthContext.getUserId(), "获取歌词排队");
        return Mess.ok(Map.of("taskId", t.getId()));
    }

    @PostMapping("/loudness/{songId}")
    public Mess loudness(@PathVariable Long songId) {
        AuthContext.requireUploader();
        MediaTask t = tasks.submit(TaskManager.LOUDNESS, null, songId,
                AuthContext.getUserId(), "响度分析排队");
        return Mess.ok(Map.of("taskId", t.getId()));
    }

    @PostMapping("/loudness/batch")
    public Mess loudnessBatch(@RequestBody BatchDTO dto) {
        AuthContext.requireAdmin();
        int n = 0;
        for (Long songId : dto.getSongIds() == null ? java.util.List.<Long>of() : dto.getSongIds()) {
            tasks.submit(TaskManager.LOUDNESS, null, songId, AuthContext.getUserId(), "批量响度分析");
            n++;
        }
        return Mess.ok(Map.of("submitted", n));
    }

    @Data
    public static class BatchDTO {
        private java.util.List<Long> songIds;
    }
}
