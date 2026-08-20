package com.musicdreamer.login.controller;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.login.dto.LoginDTO;
import com.musicdreamer.login.dto.RegisterDTO;
import com.musicdreamer.login.dto.UpdateUserInfoDTO;
import com.musicdreamer.login.service.AuthService;
import com.musicdreamer.login.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * 用户认证与信息接口（网关路由 /api/v1/user/** → 本服务）。
 * 注册/激活/登录匿名；info 登录；internal 仅供服务间 Feign 内部调用（无鉴权）。
 */
@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;
    private final UserService userService;

    /** 注册并发送激活邮件（匿名）。 */
    @PostMapping("/register")
    public Mess register(@Valid @RequestBody RegisterDTO dto) {
        Long userId = authService.register(dto);
        Map<String, Object> data = new HashMap<>();
        data.put("userId", userId);
        return Mess.ok(data);
    }

    /** 激活令牌校验（匿名）。 */
    @GetMapping("/activate")
    public Mess activate(@RequestParam String token) {
        authService.activate(token);
        return Mess.ok();
    }

    /** 登录（匿名）。 */
    @PostMapping("/login")
    public Mess login(@Valid @RequestBody LoginDTO dto, HttpServletRequest request) {
        return Mess.ok(authService.login(dto, request));
    }

    /** 登出（登录）。 */
    @PostMapping("/logout")
    public Mess logout() {
        authService.logout();
        return Mess.ok();
    }

    /** 查询当前用户信息（登录）。 */
    @GetMapping("/info")
    public Mess info() {
        return Mess.ok(userService.info(AuthContext.requireLogin()));
    }

    /** 修改昵称/头像等基础字段（登录）。 */
    @PutMapping("/info")
    public Mess updateInfo(@RequestBody UpdateUserInfoDTO dto) {
        userService.updateInfo(AuthContext.requireLogin(), dto);
        return Mess.ok();
    }

    /** 内部接口：用户简要信息，供其他服务 Feign 调用（无鉴权，不经网关）。 */
    @GetMapping("/internal/{id}")
    public Mess internalBrief(@PathVariable Long id) {
        return Mess.ok(userService.brief(id));
    }
}
