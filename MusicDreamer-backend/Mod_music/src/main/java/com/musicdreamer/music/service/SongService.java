package com.musicdreamer.music.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.musicdreamer.common.api.ErrorCode;
import com.musicdreamer.common.auth.AuthContext;
import com.musicdreamer.common.exception.BizException;
import com.musicdreamer.music.dto.AuditDTO;
import com.musicdreamer.music.dto.InternalCreateDTO;
import com.musicdreamer.music.dto.SongEditDTO;
import com.musicdreamer.music.dto.SongSubmitDTO;
import com.musicdreamer.music.dto.VersionDTO;
import com.musicdreamer.music.entity.Song;
import com.musicdreamer.music.entity.SongVersion;
import com.musicdreamer.music.mapper.PlayHistoryMapper;
import com.musicdreamer.music.mapper.SongMapper;
import com.musicdreamer.music.mapper.SongVersionMapper;
import com.musicdreamer.music.util.CacheHelper;
import com.musicdreamer.music.vo.SongCardVO;
import com.musicdreamer.music.vo.SongDetailVO;
import com.musicdreamer.music.vo.SongPlayVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 歌曲管理：提交/播放/详情/榜单/编辑/重提/我的/管理列表/审核/下架/上架/版本。
 * 审核状态机（设计 6.1 节）：入库 1 → 通过 2 / 驳回保持 1 记原因 → 下架 0 → 重新上架 2。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SongService {

    /** 歌曲状态常量。 */
    public static final int STATUS_TAKEN_DOWN = 0;
    public static final int STATUS_UNDER_REVIEW = 1;
    public static final int STATUS_PUBLISHED = 2;

    private static final Duration CHART_TTL = Duration.ofMinutes(10);

    private final SongMapper songMapper;
    private final SongVersionMapper songVersionMapper;
    private final PlayHistoryMapper playHistoryMapper;
    private final CacheHelper cache;
    private final OperationLogService operationLogService;

    /** 提交歌曲（role>=1），入库即审核中。 */
    public Long submit(SongSubmitDTO dto) {
        AuthContext.requireUploader();
        Long singerId = AuthContext.requireLogin();

        if (StringUtils.hasText(dto.getSourceUrl())
                && songMapper.selectCount(new LambdaQueryWrapper<Song>().eq(Song::getSourceUrl, dto.getSourceUrl())) > 0) {
            throw new BizException(2002, "该链接已导入过");
        }

        Song song = new Song();
        song.setName(dto.getName());
        song.setSingerId(singerId);
        song.setAlbum(dto.getAlbum());
        song.setStyle(dto.getStyle());
        song.setLanguage(dto.getLanguage());
        song.setDuration(dto.getDuration() == null ? 0 : dto.getDuration());
        song.setFileUrl(dto.getFileUrl());
        song.setCoverUrl(dto.getCoverUrl());
        song.setLyricUrl(dto.getLyricUrl());
        song.setFileFormat(dto.getFileFormat());
        song.setSourceUrl(dto.getSourceUrl());
        song.setPlayCount(0L);
        song.setCollectCount(0);
        song.setStatus(STATUS_UNDER_REVIEW);
        songMapper.insert(song);
        log.info("song submitted: id={}, singer={}, name={}", song.getId(), singerId, song.getName());
        return song.getId();
    }

    /** 播放：按状态拦截（1→3002，0→3003，查无→3001）。 */
    public SongPlayVO play(Long id) {
        Song song = mustGet(id);
        if (song.getStatus() == STATUS_UNDER_REVIEW) {
            throw new BizException(ErrorCode.SONG_UNDER_REVIEW);
        }
        if (song.getStatus() == STATUS_TAKEN_DOWN) {
            throw new BizException(ErrorCode.SONG_TAKEN_DOWN);
        }
        SongPlayVO vo = songMapper.selectPlayById(id);
        if (vo == null) {
            throw new BizException(ErrorCode.SONG_NOT_FOUND);
        }
        return vo;
    }

    /** 详情（匿名可见）。 */
    public SongDetailVO detail(Long id) {
        SongDetailVO vo = songMapper.selectDetailById(id);
        if (vo == null) {
            throw new BizException(ErrorCode.SONG_NOT_FOUND);
        }
        return vo;
    }

    /** 榜单：hot 热门榜（Redis 缓存 10min，异常降级直查）/ rise 周榜。 */
    public Object chart(String type, int limit) {
        if (type == null || type.isBlank()) {
            type = "hot";
        }
        if ("hot".equals(type)) {
            String key = "chart:hot:" + limit;
            List<SongCardVO> cached = cache.get(key, new TypeReference<List<SongCardVO>>() {});
            if (cached != null) {
                return cached;
            }
            List<SongCardVO> list = songMapper.selectHotCards(limit);
            cache.set(key, list, CHART_TTL);
            return list;
        }
        if ("rise".equals(type)) {
            return playHistoryMapper.selectRise(limit);
        }
        throw new BizException(ErrorCode.PARAM_FORMAT_ERROR);
    }

    /** 编辑元数据：本人或管理员。 */
    public void edit(Long id, SongEditDTO dto) {
        Song song = mustGet(id);
        requireOwnerOrAdmin(song);

        LambdaUpdateWrapper<Song> uw = new LambdaUpdateWrapper<Song>().eq(Song::getId, id);
        if (StringUtils.hasText(dto.getName())) uw.set(Song::getName, dto.getName());
        if (dto.getAlbum() != null) uw.set(Song::getAlbum, dto.getAlbum());
        if (dto.getStyle() != null) uw.set(Song::getStyle, dto.getStyle());
        if (dto.getLanguage() != null) uw.set(Song::getLanguage, dto.getLanguage());
        if (dto.getCoverUrl() != null) uw.set(Song::getCoverUrl, dto.getCoverUrl());
        songMapper.update(null, uw);
        operationLogService.record("EDIT", "PUT",
                Map.of("songId", id, "singerId", song.getSingerId()));
    }

    /** 驳回后重新提交：清 reject_reason，保持待审。 */
    public void resubmit(Long id) {
        Song song = mustGet(id);
        requireOwnerOrAdmin(song);
        if (song.getStatus() != STATUS_UNDER_REVIEW || !StringUtils.hasText(song.getRejectReason())) {
            throw new BizException(ErrorCode.PARAM_OUT_OF_RANGE, "仅被驳回的歌曲可重新提交");
        }
        songMapper.update(null, new LambdaUpdateWrapper<Song>()
                .eq(Song::getId, id)
                .set(Song::getRejectReason, null));
    }

    /** 我上传的歌（管理员看全部）。 */
    public Map<String, Object> mine(int page, int size, Integer status) {
        Long uid = AuthContext.requireLogin();
        Page<Song> pager = new Page<>(page, size);
        LambdaQueryWrapper<Song> w = new LambdaQueryWrapper<>();
        if (AuthContext.getRole() != AuthContext.ROLE_ADMIN) {
            w.eq(Song::getSingerId, uid);
        }
        w.eq(status != null, Song::getStatus, status)
                .orderByDesc(Song::getCreateTime)
                .orderByDesc(Song::getId);
        songMapper.selectPage(pager, w);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", pager.getTotal());
        result.put("songs", pager.getRecords());
        return result;
    }

    /** 管理端全量列表。 */
    public Map<String, Object> adminList(int page, int size, Integer status, String keyword) {
        AuthContext.requireAdmin();
        Page<Song> pager = new Page<>(page, size);
        LambdaQueryWrapper<Song> w = new LambdaQueryWrapper<Song>()
                .eq(status != null, Song::getStatus, status)
                .like(StringUtils.hasText(keyword), Song::getName, keyword)
                .orderByDesc(Song::getCreateTime)
                .orderByDesc(Song::getId);
        songMapper.selectPage(pager, w);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", pager.getTotal());
        result.put("songs", pager.getRecords());
        return result;
    }

    /** 审核：通过→2 记 auditor/audit_time；驳回→保持 1 记原因。 */
    public void audit(AuditDTO dto) {
        Long adminId = AuthContext.requireLogin();
        AuthContext.requireAdmin();
        Song song = mustGet(dto.getSongId());
        if (Boolean.TRUE.equals(dto.getPass())) {
            songMapper.update(null, new LambdaUpdateWrapper<Song>()
                    .eq(Song::getId, song.getId())
                    .set(Song::getStatus, STATUS_PUBLISHED)
                    .set(Song::getAuditorId, adminId)
                    .set(Song::getAuditTime, LocalDateTime.now())
                    .set(Song::getRejectReason, null));
        } else {
            if (!StringUtils.hasText(dto.getRejectReason())) {
                throw new BizException(ErrorCode.PARAM_MISSING, "驳回原因不能为空");
            }
            songMapper.update(null, new LambdaUpdateWrapper<Song>()
                    .eq(Song::getId, song.getId())
                    .set(Song::getStatus, STATUS_UNDER_REVIEW)
                    .set(Song::getRejectReason, dto.getRejectReason()));
        }
        operationLogService.record("AUDIT", "POST", Map.of(
                "songId", song.getId(),
                "pass", Boolean.TRUE.equals(dto.getPass()),
                "rejectReason", dto.getRejectReason() == null ? "" : dto.getRejectReason()));
    }

    /** 下架：status=0，原因记入 reject_reason。 */
    public void takedown(Long id, String reason) {
        AuthContext.requireAdmin();
        Song song = mustGet(id);
        songMapper.update(null, new LambdaUpdateWrapper<Song>()
                .eq(Song::getId, id)
                .set(Song::getStatus, STATUS_TAKEN_DOWN)
                .set(Song::getRejectReason, reason));
        operationLogService.record("TAKEDOWN", "POST", Map.of("songId", id, "reason", reason));
        log.info("song taken down: id={}, operator={}", id, AuthContext.getUserId());
    }

    /** 重新上架：status=2。 */
    public void relist(Long id) {
        AuthContext.requireAdmin();
        mustGet(id);
        songMapper.update(null, new LambdaUpdateWrapper<Song>()
                .eq(Song::getId, id)
                .set(Song::getStatus, STATUS_PUBLISHED)
                .set(Song::getRejectReason, null));
        operationLogService.record("RELIST", "POST", Map.of("songId", id));
    }

    /** 版本列表（本人或管理员）。 */
    public List<SongVersion> versions(Long songId) {
        Song song = mustGet(songId);
        requireOwnerOrAdmin(song);
        return songVersionMapper.selectList(new LambdaQueryWrapper<SongVersion>()
                .eq(SongVersion::getSongId, songId)
                .orderByDesc(SongVersion::getVersion));
    }

    /** 追加版本：version=max+1，进入版本审核中（song_version 语义 status=2）。 */
    public Long addVersion(Long songId, VersionDTO dto) {
        Song song = mustGet(songId);
        requireOwnerOrAdmin(song);

        SongVersion last = songVersionMapper.selectOne(new LambdaQueryWrapper<SongVersion>()
                .eq(SongVersion::getSongId, songId)
                .orderByDesc(SongVersion::getVersion)
                .last("LIMIT 1"));

        SongVersion v = new SongVersion();
        v.setSongId(songId);
        v.setVersion(last == null ? 1 : last.getVersion() + 1);
        v.setFileUrl(dto.getFileUrl());
        v.setFileFormat(dto.getFileFormat());
        v.setFileSize(dto.getFileSize() == null ? 0L : dto.getFileSize());
        v.setDuration(dto.getDuration() == null ? 0 : dto.getDuration());
        v.setStatus(2);
        songVersionMapper.insert(v);
        return v.getId();
    }

    /** ---------- 内部接口（Feign，无鉴权） ---------- */

    public Song internalGet(Long id) {
        return mustGet(id);
    }

    public List<Song> internalBatch(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        return songMapper.selectBatchIds(ids);
    }

    public Song internalBySource(String url) {
        if (!StringUtils.hasText(url)) {
            throw new BizException(ErrorCode.PARAM_MISSING, "url 不能为空");
        }
        Song song = songMapper.selectOne(new LambdaQueryWrapper<Song>()
                .eq(Song::getSourceUrl, url).last("LIMIT 1"));
        if (song == null) {
            throw new BizException(ErrorCode.SONG_NOT_FOUND);
        }
        return song;
    }

    public Long internalCreate(InternalCreateDTO dto) {
        if (StringUtils.hasText(dto.getSourceUrl())
                && songMapper.selectCount(new LambdaQueryWrapper<Song>().eq(Song::getSourceUrl, dto.getSourceUrl())) > 0) {
            throw new BizException(2002, "该链接已导入过");
        }
        Song song = new Song();
        song.setName(dto.getName());
        song.setSingerId(dto.getSingerId());
        song.setAlbum(null);
        song.setDuration(dto.getDuration() == null ? 0 : dto.getDuration());
        song.setFileUrl(dto.getFileUrl());
        song.setCoverUrl(dto.getCoverUrl());
        song.setFileFormat(dto.getFileFormat());
        song.setSourceUrl(dto.getSourceUrl());
        song.setPlayCount(0L);
        song.setCollectCount(0);
        song.setStatus(STATUS_UNDER_REVIEW);
        songMapper.insert(song);
        log.info("song created by media pipeline: id={}, source={}", song.getId(), dto.getSourceUrl());
        return song.getId();
    }

    public void internalCollectCount(Long songId, int delta) {
        mustGet(songId);
        songMapper.adjustCollectCount(songId, delta);
    }

    public void internalLoudness(Long songId, Double gain, Double integrated) {
        mustGet(songId);
        LambdaUpdateWrapper<Song> uw = new LambdaUpdateWrapper<Song>().eq(Song::getId, songId);
        if (gain != null) uw.set(Song::getVolumeGain, gain);
        if (integrated != null) uw.set(Song::getIntegratedLoudness, integrated);
        if (gain != null || integrated != null) {
            songMapper.update(null, uw);
        }
    }

    public void internalLyric(Long songId, String lyricUrl) {
        mustGet(songId);
        songMapper.update(null, new LambdaUpdateWrapper<Song>()
                .eq(Song::getId, songId)
                .set(Song::getLyricUrl, lyricUrl));
    }

    /** ---------- 私有 ---------- */

    private Song mustGet(Long id) {
        Song song = songMapper.selectById(id);
        if (song == null) {
            throw new BizException(ErrorCode.SONG_NOT_FOUND);
        }
        return song;
    }

    private void requireOwnerOrAdmin(Song song) {
        Long uid = AuthContext.requireLogin();
        if (AuthContext.getRole() != AuthContext.ROLE_ADMIN && !song.getSingerId().equals(uid)) {
            throw new BizException(ErrorCode.NO_PERMISSION);
        }
    }
}
