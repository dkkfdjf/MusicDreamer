package com.musicdreamer.music.mapper;

import com.musicdreamer.music.vo.UserSongPairVO;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 收藏表只读 Mapper（跨域读，课设简化为本地直查）：
 * 离线推荐任务用其给收藏过的（用户,歌曲）评分 +1。
 */
public interface CollectMapper {

    @Select("SELECT user_id AS userId, song_id AS songId FROM collect")
    List<UserSongPairVO> selectCollectedPairs();
}
