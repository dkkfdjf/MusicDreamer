package com.musicdreamer.login.controller;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.login.dto.ChangePasswordDTO;
import com.musicdreamer.login.dto.ResetPasswordDTO;
import com.musicdreamer.login.dto.SendCodeDTO;
import com.musicdreamer.login.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

/** 密码相关接口：send-code/reset 匿名，change 登录。 */
@RestController
@RequestMapping("/api/v1/user/password")
@RequiredArgsConstructor
public class PasswordController {

    private final AuthService authService;

    /** 第一步：发送邮箱验证码（匿名，Redis 10 分钟有效）。 */
    @PostMapping("/send-code")
    public Mess sendCode(@Valid @RequestBody SendCodeDTO dto) {
        authService.sendResetCode(dto);
        return Mess.ok();
    }

    /** 第二步：凭验证码重置密码（匿名）。 */
    @PostMapping("/reset")
    public Mess reset(@Valid @RequestBody ResetPasswordDTO dto) {
        authService.resetPassword(dto);
        return Mess.ok();
    }

    /** 登录态修改密码（登录，校验旧密码）。 */
    @PostMapping("/change")
    public Mess change(@Valid @RequestBody ChangePasswordDTO dto) {
        authService.changePassword(dto);
        return Mess.ok();
    }
}
