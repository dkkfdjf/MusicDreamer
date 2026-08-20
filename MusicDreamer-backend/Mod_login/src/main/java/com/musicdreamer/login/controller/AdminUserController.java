package com.musicdreamer.login.controller;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.login.dto.UserStatusDTO;
import com.musicdreamer.login.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

/** 管理端用户接口（管理员）。 */
@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;

    /** 用户分页列表（keyword 模糊匹配 username/nickname，不返回密码）。 */
    @GetMapping("/list")
    public Mess list(@RequestParam(defaultValue = "1") long page,
                     @RequestParam(defaultValue = "10") long size,
                     @RequestParam(required = false) String keyword) {
        AuthContext.requireAdmin();
        return Mess.ok(userService.pageUsers(page, size, keyword));
    }

    /** 禁用/启用用户。 */
    @PostMapping("/status")
    public Mess status(@Valid @RequestBody UserStatusDTO dto) {
        AuthContext.requireAdmin();
        userService.updateStatus(dto);
        return Mess.ok();
    }
}
