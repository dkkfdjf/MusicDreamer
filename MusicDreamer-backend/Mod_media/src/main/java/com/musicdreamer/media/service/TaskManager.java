package com.musicdreamer.media.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.musicdreamer.common.api.ErrorCode;
import com.musicdreamer.common.exception.BizException;
import com.musicdreamer.media.entity.MediaTask;
import com.musicdreamer.media.exec.ProcessExecutor;
import com.musicdreamer.media.mapper.MediaTaskMapper;
import com.musicdreamer.media.ws.TaskWsHandler;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 任务管理（设计 10.2）：状态机单向流转、进度 500ms 节流、调度分发（下载单并发）、
 * 指标（任务量/耗时/队列积压/进程数）、取消清理、写库失败自动重试。
 */
@Slf4j
@Service
public class TaskManager {

    public static final String DOWNLOAD = "DOWNLOAD";
    public static final String TRANSCRIBE = "TRANSCRIBE";
    public static final String LOUDNESS = "LOUDNESS";
    public static final String SUBTITLE = "SUBTITLE";
    public static final String LYRICS_FETCH = "LYRICS_FETCH";
    public static final String MODEL_DOWNLOAD = "MODEL_DOWNLOAD";
    public static final String TOOL_UPDATE = "TOOL_UPDATE";
    public static final String TOOL_INSTALL = "TOOL_INSTALL";

    private final MediaTaskMapper mapper;
    private final ProcessExecutor executor;
    private final TaskWsHandler ws;
    private final MeterRegistry registry;
    private final TaskRunnerLocator runnerLocator;

    private final AtomicBoolean downloadBusy = new AtomicBoolean(false);
    private final ExecutorService workerPool = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "media-worker");
        t.setDaemon(true);
        return t;
    });

    /** 进度节流：taskId -> 上次写库时间。 */
    private final Map<Integer, Long> lastProgressAt = new ConcurrentHashMap<>();
    /** 建库失败重试：taskId -> 下次允许执行时间 + 已重试次数由 stage 前缀携带。 */
    private final Map<Integer, Long> retryAfter = new ConcurrentHashMap<>();

    private final AtomicInteger queueGauge;
    private volatile boolean ready = false;

    @Value("${media.download-concurrency:1}")
    private int downloadConcurrency;

    public TaskManager(MediaTaskMapper mapper, ProcessExecutor executor, TaskWsHandler ws,
                       MeterRegistry registry, TaskRunnerLocator runnerLocator) {
        this.mapper = mapper;
        this.executor = executor;
        this.ws = ws;
        this.registry = registry;
        this.runnerLocator = runnerLocator;
        this.queueGauge = registry.gauge("media_task_queue_size", new AtomicInteger(0));
    }

    public void markReady() {
        this.ready = true;
    }

    public TaskRunnerLocator runnerLocator() {
        return runnerLocator;
    }

    public MediaTask submit(String type, String sourceUrl, Long songId, Long operator, String stage) {
        MediaTask t = new MediaTask();
        t.setTaskType(type);
        t.setStatus("PENDING");
        t.setProgress(0);
        t.setStage(stage);
        t.setSourceUrl(sourceUrl);
        t.setSongId(songId);
        t.setOperator(operator);
        t.setCreatedAt(LocalDateTime.now());
        mapper.insert(t);
        count("PENDING");
        return t;
    }

    public MediaTask get(int id) {
        MediaTask t = mapper.selectById(id);
        if (t == null) {
            throw new BizException(ErrorCode.PARAM_OUT_OF_RANGE, "任务不存在");
        }
        return t;
    }

    /** 节流更新进度并推送 WebSocket。 */
    public void progress(int taskId, int value, String stage) {
        long now = System.currentTimeMillis();
        Long last = lastProgressAt.get(taskId);
        if (last != null && now - last < 500) {
            return;
        }
        lastProgressAt.put(taskId, now);
        MediaTask t = mapper.selectById(taskId);
        if (t == null || !"RUNNING".equals(t.getStatus())) {
            return;
        }
        t.setProgress(Math.max(0, Math.min(100, value)));
        if (stage != null) {
            t.setStage(stage);
        }
        mapper.updateById(t);
        broadcast(t, "PROGRESS");
    }

    public void finish(int taskId, String status, String error) {
        MediaTask t = mapper.selectById(taskId);
        if (t == null) {
            return;
        }
        if ("RUNNING".equals(t.getStatus())) {
            Timer.builder("media_task_duration_seconds")
                    .tag("type", t.getTaskType()).register(registry);
        }
        t.setStatus(status);
        if (error != null) {
            t.setError(error);
        }
        if (!"PENDING".equals(status)) {
            t.setFinishedAt(LocalDateTime.now());
        }
        if ("SUCCESS".equals(status)) {
            t.setProgress(100);
        }
        mapper.updateById(t);
        lastProgressAt.remove(taskId);
        retryAfter.remove(taskId);
        count(status);
        broadcast(t, switch (status) {
            case "SUCCESS" -> "SUCCESS";
            case "CANCELLED" -> "CANCELLED";
            default -> "FAILED";
        });
    }

    /** 写库类失败：回 PENDING 定时重试（30 秒间隔，至多 3 次）。 */
    public void retryLater(int taskId, int retryCount) {
        if (retryCount >= 3) {
            finish(taskId, "FAILED", "入库失败，已重试 3 次，请稍后重新提交");
            return;
        }
        MediaTask t = mapper.selectById(taskId);
        if (t == null) return;
        t.setStatus("PENDING");
        t.setStage("下游服务暂不可用，30 秒后自动重试（第 " + (retryCount + 1) + " 次）");
        mapper.updateById(t);
        retryAfter.put(taskId, System.currentTimeMillis() + 30_000L);
        broadcast(t, "PROGRESS");
    }

    public void scheduleAt(int taskId, long atMs) {
        retryAfter.put(taskId, atMs);
    }

    /** 持久化任务产出的歌曲关联（下载管线入库后调用）。 */
    public void attachSong(int taskId, Long songId) {
        MediaTask t = mapper.selectById(taskId);
        if (t != null) {
            t.setSongId(songId);
            mapper.updateById(t);
        }
    }

    public boolean cancel(int taskId) {
        MediaTask t = mapper.selectById(taskId);
        if (t == null) {
            throw new BizException(ErrorCode.PARAM_OUT_OF_RANGE, "任务不存在");
        }
        if ("SUCCESS".equals(t.getStatus()) || "FAILED".equals(t.getStatus())
                || "CANCELLED".equals(t.getStatus())) {
            return false;
        }
        executor.cancel(cancelKey(taskId));
        finish(taskId, "CANCELLED", null);
        return true;
    }

    public static String cancelKey(int taskId) {
        return "task:" + taskId;
    }

    /** 任务分发：2 秒轮询 PENDING；下载单并发，其余进线程池。 */
    @Scheduled(fixedDelay = 2000)
    public void dispatch() {
        if (!ready) {
            return;
        }
        queueGauge.set(countPending());
        List<MediaTask> pending = mapper.selectList(new LambdaQueryWrapper<MediaTask>()
                .eq(MediaTask::getStatus, "PENDING").orderByAsc(MediaTask::getId).last("limit 20"));
        long now = System.currentTimeMillis();
        for (MediaTask t : pending) {
            Long after = retryAfter.get(t.getId());
            if (after != null && now < after) {
                continue;
            }
            retryAfter.remove(t.getId());
            if (DOWNLOAD.equals(t.getTaskType())) {
                if (!downloadBusy.compareAndSet(false, true)) {
                    continue; // 设计：下载单并发，降低风控概率
                }
                run(t, () -> downloadBusy.set(false));
            } else {
                workerPool.submit(() -> run(t, () -> { }));
            }
        }
    }

    private void run(MediaTask t, Runnable release) {
        t.setStatus("RUNNING");
        t.setStage(t.getStage() == null ? "开始执行" : t.getStage());
        mapper.updateById(t);
        count("RUNNING");
        Timer.Sample sample = Timer.start(registry);
        try {
            runnerLocator.runner(t.getTaskType()).run(t);
            sample.stop(Timer.builder("media_task_duration_seconds")
                    .tag("type", t.getTaskType()).register(registry));
        } catch (Exception e) {
            log.error("task {} failed", t.getId(), e);
            finish(t.getId(), "FAILED", "任务执行异常：" + e.getMessage());
        } finally {
            release.run();
        }
    }

    private int countPending() {
        return Math.toIntExact(mapper.selectCount(new LambdaQueryWrapper<MediaTask>()
                .eq(MediaTask::getStatus, "PENDING")));
    }

    private void count(String status) {
        try {
            registry.counter("media_task_total", "status", status).increment();
        } catch (Exception ignored) {
        }
    }

    private void broadcast(MediaTask t, String event) {
        if (ws == null) return;
        String data = "{\"status\":\"" + t.getStatus() + "\",\"progress\":" + t.getProgress()
                + (t.getStage() == null ? "" : ",\"stage\":\"" + t.getStage().replace("\"", "'") + "\"")
                + (t.getSongId() == null ? "" : ",\"musicId\":" + t.getSongId())
                + (t.getError() == null ? "" : ",\"error\":\"" + t.getError().replace("\"", "'") + "\"")
                + ",\"timestamp\":" + System.currentTimeMillis() + "}";
        ws.broadcast(t.getId(), event, data);
    }

    /** 任务类型 -> 执行器的定位器（避免循环依赖集中注入）。 */
    public interface TaskRunner {
        void run(MediaTask task);
    }

    @org.springframework.stereotype.Component
    public static class TaskRunnerLocator {
        private final java.util.Map<String, TaskRunner> runners = new ConcurrentHashMap<>();

        public void register(String type, TaskRunner runner) {
            runners.put(type, runner);
        }

        public TaskRunner runner(String type) {
            TaskRunner r = runners.get(type);
            if (r == null) {
                throw new BizException(ErrorCode.SYSTEM_ERROR, "未知任务类型：" + type);
            }
            return r;
        }
    }
}
