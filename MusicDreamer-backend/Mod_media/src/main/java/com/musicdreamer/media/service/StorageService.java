package com.musicdreamer.media.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/** 存储目录管理：{storage-root}/{music|image|lyric|task}；fileUrl 与本地路径互转。 */
@Service
@RequiredArgsConstructor
public class StorageService {

    private final SettingsService settings;

    public Path dir(String type) {
        Path p = Paths.get(settings.storageRoot(), type).toAbsolutePath().normalize();
        try {
            Files.createDirectories(p);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建存储目录 " + p, e);
        }
        return p;
    }

    public Path root() {
        return Paths.get(settings.storageRoot()).toAbsolutePath().normalize();
    }

    /** /data/music/1.mp3 -> {storageRoot}/music/1.mp3（跨服务 fileUrl 统一转本地）。 */
    public Path localPath(String fileUrl) {
        if (fileUrl == null) return null;
        String rel = fileUrl;
        int idx = rel.indexOf("/data/");
        if (idx >= 0) {
            rel = rel.substring(idx + "/data".length());
        }
        return root().resolve(rel.startsWith("/") || rel.startsWith("\\") ? rel.substring(1) : rel).normalize();
    }

    public String fileUrl(String type, String name) {
        return "/data/" + type + "/" + name;
    }

    /** 模型目录探测：{storage}/models -> ./tools/models -> ../tools/models。 */
    public Path modelsDir() {
        Path primary = root().resolve("models");
        if (Files.isDirectory(primary)) return primary;
        for (String alt : new String[]{"tools/models", "../tools/models"}) {
            Path p = Paths.get(alt).toAbsolutePath().normalize();
            if (Files.isDirectory(p)) return p;
        }
        try {
            Files.createDirectories(primary);
        } catch (IOException ignored) {
        }
        return primary;
    }
}
