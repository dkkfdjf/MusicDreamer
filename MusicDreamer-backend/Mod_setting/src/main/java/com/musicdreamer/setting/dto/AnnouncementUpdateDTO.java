package com.musicdreamer.setting.dto;

import lombok.Data;

/** 修改公告请求（仅更新提交的非空字段）。 */
@Data
public class AnnouncementUpdateDTO {

    private String title;

    private String content;

    private Integer type;
}
