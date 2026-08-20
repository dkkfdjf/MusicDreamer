package com.musicdreamer.music.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/** 播完上报：同一事务写 play_history 明细 + song.play_count 热计数。 */
@Data
public class PlayReportDTO {

    @NotNull(message = "songId 不能为空")
    private Long songId;

    private Integer playDuration;
}
