package com.musicdreamer.login.service;

import com.musicdreamer.login.dto.ChangePasswordDTO;
import com.musicdreamer.login.dto.LoginDTO;
import com.musicdreamer.login.dto.RegisterDTO;
import com.musicdreamer.login.dto.ResetPasswordDTO;
import com.musicdreamer.login.dto.SendCodeDTO;
import com.musicdreamer.login.vo.LoginVO;

import javax.servlet.http.HttpServletRequest;

/** 注册/激活、登录/登出、找回与修改密码（设计文档 5.1）。 */
public interface AuthService {

    /** 注册并发送激活邮件，返回新用户 ID。 */
    Long register(RegisterDTO dto);

    /** 激活令牌校验。 */
    void activate(String token);

    /** 登录校验并签发 JWT，写 operation_log。 */
    LoginVO login(LoginDTO dto, HttpServletRequest request);

    /** 登出：删除 Redis 会话记录。 */
    void logout();

    /** 发送找回密码验证码（Redis 10 分钟）。 */
    void sendResetCode(SendCodeDTO dto);

    /** 凭验证码重置密码。 */
    void resetPassword(ResetPasswordDTO dto);

    /** 登录态修改密码。 */
    void changePassword(ChangePasswordDTO dto);
}
