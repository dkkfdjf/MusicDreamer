package com.musicdreamer.music.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.musicdreamer.music.entity.Song;
import com.musicdreamer.music.vo.SongCardVO;
import com.musicdreamer.music.vo.SongDetailVO;
import com.musicdreamer.music.vo.SongPlayVO;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/** 歌曲表 Mapper：简单 CRUD 走 BaseMapper，join user/聚合查询走注解 SQL。 */
public interface SongMapper extends BaseMapper<Song> {

    String CARD_COLS = "s.id, s.name, COALESCE(u.nickname, u.username) AS singer, "
            + "s.singer_id AS singerId, s.album, s.style, s.cover_url AS coverUrl, s.play_count AS playCount";

    /** 播放视图（join user 取歌手昵称）。 */
    @Select("SELECT s.id AS songId, s.name, COALESCE(u.nickname, u.username) AS singer, "
            + "s.singer_id AS singerId, s.album, s.file_url AS fileUrl, s.cover_url AS coverUrl, "
            + "s.lyric_url AS lyricUrl, s.duration, s.volume_gain AS volumeGain, s.file_format AS fileFormat "
            + "FROM song s LEFT JOIN user u ON u.id = s.singer_id WHERE s.id = #{id}")
    SongPlayVO selectPlayById(@Param("id") Long id);

    /** 详情视图（含热计数与状态）。 */
    @Select("SELECT s.id AS songId, s.name, COALESCE(u.nickname, u.username) AS singer, "
            + "s.singer_id AS singerId, s.album, s.style, s.language, s.duration, "
            + "s.file_url AS fileUrl, s.cover_url AS coverUrl, s.lyric_url AS lyricUrl, s.file_format AS fileFormat, "
            + "s.play_count AS playCount, s.collect_count AS collectCount, s.volume_gain AS volumeGain, "
            + "s.status, s.create_time AS createTime "
            + "FROM song s LEFT JOIN user u ON u.id = s.singer_id WHERE s.id = #{id}")
    SongDetailVO selectDetailById(@Param("id") Long id);

    /** 全站热门榜（仅已发布）。 */
    @Select("SELECT " + CARD_COLS + " FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 ORDER BY s.play_count DESC, s.id DESC LIMIT #{limit}")
    List<SongCardVO> selectHotCards(@Param("limit") int limit);

    /** 搜索歌曲：歌名或歌手名匹配（仅已发布）。 */
    @Select("SELECT " + CARD_COLS + " FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 AND (s.name LIKE CONCAT('%', #{kw}, '%') "
            + "OR u.username LIKE CONCAT('%', #{kw}, '%') OR u.nickname LIKE CONCAT('%', #{kw}, '%')) "
            + "ORDER BY s.play_count DESC, s.id DESC LIMIT #{offset}, #{size}")
    List<SongCardVO> searchCards(@Param("kw") String kw, @Param("offset") long offset, @Param("size") int size);

    @Select("SELECT COUNT(*) FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 AND (s.name LIKE CONCAT('%', #{kw}, '%') "
            + "OR u.username LIKE CONCAT('%', #{kw}, '%') OR u.nickname LIKE CONCAT('%', #{kw}, '%'))")
    long countSearch(@Param("kw") String kw);

    /** 分类浏览：风格/语言组合过滤。 */
    @Select("<script>SELECT " + CARD_COLS + " FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 "
            + "<if test='style != null and style != \"\"'> AND s.style = #{style}</if> "
            + "<if test='language != null and language != \"\"'> AND s.language = #{language}</if> "
            + "ORDER BY s.play_count DESC, s.id DESC LIMIT #{offset}, #{size}</script>")
    List<SongCardVO> selectByStyle(@Param("style") String style, @Param("language") String language,
                                   @Param("offset") long offset, @Param("size") int size);

    @Select("<script>SELECT COUNT(*) FROM song s WHERE s.status = 2 "
            + "<if test='style != null and style != \"\"'> AND s.style = #{style}</if> "
            + "<if test='language != null and language != \"\"'> AND s.language = #{language}</if> "
            + "</script>")
    long countByStyle(@Param("style") String style, @Param("language") String language);

    /** 去重风格列表（分类入口）。 */
    @Select("SELECT DISTINCT style FROM song WHERE status = 2 AND style IS NOT NULL AND style != '' ORDER BY style")
    List<String> selectDistinctStyles();

    /** 按 ID 集合批量取卡片（仅已发布）。 */
    @Select("<script>SELECT " + CARD_COLS + " FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 AND s.id IN "
            + "<foreach collection='ids' item='item' open='(' separator=',' close=')'>#{item}</foreach> "
            + "</script>")
    List<SongCardVO> selectCardsByIds(@Param("ids") List<Long> ids);

    /** 同歌手热门补齐（排除已听与已选）。 */
    @Select("<script>SELECT " + CARD_COLS + " FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 AND s.singer_id IN "
            + "<foreach collection='singerIds' item='item' open='(' separator=',' close=')'>#{item}</foreach> "
            + "<if test='excludeIds != null and !excludeIds.isEmpty()'> AND s.id NOT IN "
            + "<foreach collection='excludeIds' item='item' open='(' separator=',' close=')'>#{item}</foreach></if> "
            + "ORDER BY s.play_count DESC, s.id DESC LIMIT #{limit}</script>")
    List<SongCardVO> selectCardsBySingers(@Param("singerIds") List<Long> singerIds,
                                          @Param("excludeIds") List<Long> excludeIds,
                                          @Param("limit") int limit);

    /** 同风格热门补齐（排除已听与已选）。 */
    @Select("<script>SELECT " + CARD_COLS + " FROM song s LEFT JOIN user u ON u.id = s.singer_id "
            + "WHERE s.status = 2 AND s.style IN "
            + "<foreach collection='styles' item='item' open='(' separator=',' close=')'>#{item}</foreach> "
            + "<if test='excludeIds != null and !excludeIds.isEmpty()'> AND s.id NOT IN "
            + "<foreach collection='excludeIds' item='item' open='(' separator=',' close=')'>#{item}</foreach></if> "
            + "ORDER BY s.play_count DESC, s.id DESC LIMIT #{limit}</script>")
    List<SongCardVO> selectCardsByStyles(@Param("styles") List<String> styles,
                                         @Param("excludeIds") List<Long> excludeIds,
                                         @Param("limit") int limit);

    /** 播放热计数 +1（与明细同事务，设计 6.3 节）。 */
    @Update("UPDATE song SET play_count = play_count + 1 WHERE id = #{id}")
    int incrementPlayCount(@Param("id") Long id);

    /** 收藏计数增减（下限 0）。 */
    @Update("UPDATE song SET collect_count = GREATEST(collect_count + #{delta}, 0) WHERE id = #{songId}")
    int adjustCollectCount(@Param("songId") Long songId, @Param("delta") int delta);
}
