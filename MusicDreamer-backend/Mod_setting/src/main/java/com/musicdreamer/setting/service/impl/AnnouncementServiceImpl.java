package com.musicdreamer.setting.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.musicdreamer.common.api.ErrorCode;
import com.musicdreamer.common.exception.BizException;
import com.musicdreamer.setting.dto.AnnouncementCreateDTO;
import com.musicdreamer.setting.dto.AnnouncementUpdateDTO;
import com.musicdreamer.setting.entity.Announcement;
import com.musicdreamer.setting.mapper.AnnouncementMapper;
import com.musicdreamer.setting.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnnouncementServiceImpl implements AnnouncementService {

    private final AnnouncementMapper announcementMapper;

    @Override
    public List<Announcement> list(Integer type) {
        LambdaQueryWrapper<Announcement> wrapper = new LambdaQueryWrapper<Announcement>()
                .eq(Announcement::getStatus, 1)
                .orderByDesc(Announcement::getCreateTime)
                .orderByDesc(Announcement::getId);
        if (type != null) {
            wrapper.eq(Announcement::getType, type);
        }
        return announcementMapper.selectList(wrapper);
    }

    @Override
    public Long create(AnnouncementCreateDTO dto, Long publisherId) {
        Announcement entity = new Announcement();
        entity.setTitle(dto.getTitle());
        entity.setContent(dto.getContent());
        entity.setType(dto.getType());
        entity.setPublisherId(publisherId);
        entity.setStatus(1);
        announcementMapper.insert(entity);
        log.info("公告创建 id={} publisher={}", entity.getId(), publisherId);
        return entity.getId();
    }

    @Override
    public void update(Long id, AnnouncementUpdateDTO dto) {
        requireExist(id);
        LambdaUpdateWrapper<Announcement> wrapper = new LambdaUpdateWrapper<Announcement>()
                .eq(Announcement::getId, id);
        if (StringUtils.hasText(dto.getTitle())) {
            wrapper.set(Announcement::getTitle, dto.getTitle());
        }
        if (StringUtils.hasText(dto.getContent())) {
            wrapper.set(Announcement::getContent, dto.getContent());
        }
        if (dto.getType() != null) {
            wrapper.set(Announcement::getType, dto.getType());
        }
        announcementMapper.update(null, wrapper);
    }

    @Override
    public void offline(Long id) {
        requireExist(id);
        announcementMapper.update(null, new LambdaUpdateWrapper<Announcement>()
                .eq(Announcement::getId, id)
                .set(Announcement::getStatus, 0));
        log.info("公告下线 id={}", id);
    }

    private void requireExist(Long id) {
        if (announcementMapper.selectById(id) == null) {
            throw new BizException(ErrorCode.PARAM_FORMAT_ERROR.getCode(), "公告不存在");
        }
    }
}
