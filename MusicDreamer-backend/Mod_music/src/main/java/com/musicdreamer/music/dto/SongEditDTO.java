package com.musicdreamer.music.dto;

import lombok.Data;

/** 歌曲元数据编辑（本人或管理员，仅元数据不动文件与状态）。 */
@Data
public class SongEditDTO {

    private String name;

    private String album;

    private String style;

    private String language;

    private String coverUrl;
}
