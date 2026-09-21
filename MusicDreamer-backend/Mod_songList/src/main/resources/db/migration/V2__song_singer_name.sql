-- V2：song 表增加 singer_name 自由文本列。
-- 场景：管理员从外站导入他人作品时填写原始歌手名；所有展示口径
-- （卡片/详情/最近播放/榜单/管理列表）优先取该列，为空时回落注册歌手昵称。
-- 幂等写法：init.sql 已含该列（与 V1/V3/V4 同策略），老库无列时才补。
-- MySQL 8 无 ADD COLUMN IF NOT EXISTS，借 information_schema 条件执行。
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'song' AND COLUMN_NAME = 'singer_name'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE song ADD COLUMN singer_name VARCHAR(64) NULL COMMENT ''导入歌曲的原始歌手名（优先于注册歌手昵称展示）'' AFTER singer_id',
  'SELECT ''singer_name already exists, skip''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
