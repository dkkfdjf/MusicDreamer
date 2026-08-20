package com.musicdreamer.setting.controller;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.setting.dto.AnnouncementCreateDTO;
import com.musicdreamer.setting.dto.AnnouncementUpdateDTO;
import com.musicdreamer.setting.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/** 公告接口：list 匿名可读；create/update/delete 管理员。 */
@RestController
@RequestMapping("/api/v1/announcement")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    /** 已发布公告列表（匿名，?type= 筛选，create_time 倒序）。 */
    @GetMapping("/list")
    public Mess list(@RequestParam(required = false) Integer type) {
        return Mess.ok(announcementService.list(type));
    }

    /** 创建公告（管理员）。 */
    @PostMapping("/create")
    public Mess create(@Valid @RequestBody AnnouncementCreateDTO dto) {
        AuthContext.requireAdmin();
        Long id = announcementService.create(dto, AuthContext.requireLogin());
        Map<String, Object> data = new HashMap<>();
        data.put("id", id);
        return Mess.ok(data);
    }

    /** 修改公告（管理员）。 */
    @PutMapping("/{id}")
    public Mess update(@PathVariable Long id, @RequestBody AnnouncementUpdateDTO dto) {
        AuthContext.requireAdmin();
        announcementService.update(id, dto);
        return Mess.ok();
    }

    /** 下线公告（管理员，status=0 软删除）。 */
    @DeleteMapping("/{id}")
    public Mess delete(@PathVariable Long id) {
        AuthContext.requireAdmin();
        announcementService.offline(id);
        return Mess.ok();
    }
}
