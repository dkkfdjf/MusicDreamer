package com.musicdreamer.setting.service;

import com.musicdreamer.setting.dto.AnnouncementCreateDTO;
import com.musicdreamer.setting.dto.AnnouncementUpdateDTO;
import com.musicdreamer.setting.entity.Announcement;

import java.util.List;

/** 公告管理：匿名列表、管理员增改下线。 */
public interface AnnouncementService {

    /** 已发布公告列表（可按类型筛选，create_time 倒序）。 */
    List<Announcement> list(Integer type);

    /** 创建公告，返回公告 ID。 */
    Long create(AnnouncementCreateDTO dto, Long publisherId);

    /** 修改公告（仅更新非空字段）。 */
    void update(Long id, AnnouncementUpdateDTO dto);

    /** 下线公告（status=0 软删除）。 */
    void offline(Long id);
}
