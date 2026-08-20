package com.musicdreamer.music.vo;

import lombok.Data;

import java.time.LocalDateTime;

/** 歌曲详情（匿名可见，含歌手昵称与热计数）。 */
@Data
public class SongDetailVO {

    private Long songId;

    private String name;

    private String singer;

    private Long singerId;

    private String album;

    private String style;

    private String language;

    private Integer duration;

    private String fileUrl;

    private String coverUrl;

    private String lyricUrl;

    private String fileFormat;

    private Long playCount;

    private Integer collectCount;

    private Double volumeGain;

    private Integer status;

    private LocalDateTime createTime;
}
