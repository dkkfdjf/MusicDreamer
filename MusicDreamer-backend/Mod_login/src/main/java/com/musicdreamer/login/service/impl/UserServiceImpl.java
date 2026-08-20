package com.musicdreamer.login.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.musicdreamer.common.api.ErrorCode;
import com.musicdreamer.common.exception.BizException;
import com.musicdreamer.login.dto.UpdateUserInfoDTO;
import com.musicdreamer.login.dto.UserStatusDTO;
import com.musicdreamer.login.entity.User;
import com.musicdreamer.login.mapper.UserMapper;
import com.musicdreamer.login.service.UserService;
import com.musicdreamer.login.vo.UserBriefVO;
import com.musicdreamer.login.vo.UserVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;

    @Override
    public UserVO info(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.USER_NOT_FOUND);
        }
        return toVO(user);
    }

    @Override
    public void updateInfo(Long userId, UpdateUserInfoDTO dto) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.USER_NOT_FOUND);
        }
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<User>().eq(User::getId, userId);
        boolean changed = false;
        if (StringUtils.hasText(dto.getNickname())) {
            wrapper.set(User::getNickname, dto.getNickname());
            changed = true;
        }
        if (StringUtils.hasText(dto.getAvatar())) {
            wrapper.set(User::getAvatar, dto.getAvatar());
            changed = true;
        }
        if (changed) {
            userMapper.update(null, wrapper);
        }
    }

    @Override
    public Map<String, Object> pageUsers(long page, long size, String keyword) {
        Page<User> p = new Page<>(Math.max(page, 1), size <= 0 ? 10 : Math.min(size, 100));
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>();
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(User::getUsername, kw).or().like(User::getNickname, kw));
        }
        wrapper.orderByDesc(User::getId);
        Page<User> result = userMapper.selectPage(p, wrapper);
        List<UserVO> list = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        Map<String, Object> data = new HashMap<>();
        data.put("total", result.getTotal());
        data.put("page", result.getCurrent());
        data.put("size", result.getSize());
        data.put("list", list);
        return data;
    }

    @Override
    public void updateStatus(UserStatusDTO dto) {
        User user = userMapper.selectById(dto.getUserId());
        if (user == null) {
            throw new BizException(ErrorCode.USER_NOT_FOUND);
        }
        if (dto.getStatus() == null || (dto.getStatus() != 0 && dto.getStatus() != 1)) {
            throw new BizException(ErrorCode.PARAM_OUT_OF_RANGE.getCode(), "status 仅允许 0(禁用) 或 1(启用)");
        }
        userMapper.update(null, new LambdaUpdateWrapper<User>()
                .eq(User::getId, dto.getUserId())
                .set(User::getStatus, dto.getStatus()));
    }

    @Override
    public UserBriefVO brief(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.USER_NOT_FOUND);
        }
        UserBriefVO vo = new UserBriefVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setNickname(StringUtils.hasText(user.getNickname()) ? user.getNickname() : user.getUsername());
        vo.setAvatar(user.getAvatar());
        vo.setRole(user.getRole());
        return vo;
    }

    private UserVO toVO(User user) {
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(user, vo);
        return vo;
    }
}
