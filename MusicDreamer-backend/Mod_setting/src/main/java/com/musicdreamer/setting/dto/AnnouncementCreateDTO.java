package com.musicdreamer.setting.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/** 创建公告请求。 */
@Data
public class AnnouncementCreateDTO {

    @NotBlank(message = "公告标题不能为空")
    private String title;

    @NotBlank(message = "公告内容不能为空")
    private String content;

    /** 1 系统 2 运营 3 活动。 */
    @NotNull(message = "公告类型不能为空")
    private Integer type;
}
