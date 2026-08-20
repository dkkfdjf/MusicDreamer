package com.musicdreamer.login.service;

import com.musicdreamer.login.dto.UpdateUserInfoDTO;
import com.musicdreamer.login.dto.UserStatusDTO;
import com.musicdreamer.login.vo.UserBriefVO;
import com.musicdreamer.login.vo.UserVO;

import java.util.Map;

/** 用户信息维护与管理（F014-F016、管理端）。 */
public interface UserService {

    /** 查询当前用户信息。 */
    UserVO info(Long userId);

    /** 修改昵称/头像等基础字段。 */
    void updateInfo(Long userId, UpdateUserInfoDTO dto);

    /** 管理端用户分页列表（模糊匹配用户名/昵称，不返回密码）。 */
    Map<String, Object> pageUsers(long page, long size, String keyword);

    /** 管理端禁用/启用用户。 */
    void updateStatus(UserStatusDTO dto);

    /** 内部调用：用户简要信息。 */
    UserBriefVO brief(Long userId);
}
