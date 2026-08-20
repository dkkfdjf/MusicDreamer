package com.musicdreamer.media.controller;

import com.musicdreamer.common.api.ErrorCode;
import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.common.exception.BizException;
import com.musicdreamer.media.entity.MediaTask;
import com.musicdreamer.media.service.TaskManager;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
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
        if (!SUPPORTED.matcher(dto.getUrl()).find()) {
            throw new BizException(ErrorCode.FILE_TYPE_UNSUPPORTED.getCode(), "不支持的链接");
        }
        MediaTask t = tasks.submit(TaskManager.DOWNLOAD, dto.getUrl(), null,
                AuthContext.getUserId(), "排队中…");
        Map<String, Object> data = new HashMap<>();
        data.put("taskId", t.getId());
        data.put("estimatedTime", "1-5 分钟");
        return Mess.ok(data);
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
