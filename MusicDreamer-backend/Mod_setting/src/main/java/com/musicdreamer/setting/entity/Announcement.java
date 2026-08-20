package com.musicdreamer.setting.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 系统公告表（init.sql：announcement）。 */
@Data
@TableName("announcement")
public class Announcement {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String content;

    /** 1 系统 2 运营 3 活动。 */
    private Integer type;

    private Long publisherId;

    /** 0 下线 1 发布。 */
    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
