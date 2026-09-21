#!/usr/bin/env bash
# MusicDreamer 部署打包脚本 —— 排除本机专属的大文件，只打 2G 服务器需要的东西
# 产物：项目根的 musicdreamer-deploy-YYYYMMDD-HHMM.tar.gz
#
# 服务器形态（配合 MusicDreamer-backend/docker-compose.prod.yml）：
#   只跑基本业务：mysql/redis/nacos + gateway/login/music/songlist/like/upload 共 6 个微服务
#   不跑：mod-media（AI 听写/B站导入，-Xmx1g 大户）、mod-setting、监控四件套
#   不需要前端：小程序直连网关 8080，Vue Web 版只是本地开发预览
#
# 排除清单（均为本机/Windows 专属或运行期可再生）：
#   tools/               Windows 二进制（ffmpeg.exe/maven/nacos 压缩包），Linux 用不了
#   */target/            Maven 编译产物；核心 jar 由下方显式追加进包（服务器 docker build COPY 用）
#   .git/                版本历史（含 220M 二进制）
#   data/models/         Whisper 模型 466M，2G 内存带不动 AI 听写，线上用已上传 lrc
#   data/task/           AI 听写/B站导入的任务缓存 wav（约 20M 测试文件）
#   docker-extras/       yt-dlp_linux + whisper tar（只有 Dockerfile.media 用，prod 不 build media）
#   node_modules/ dist/  前端依赖与构建产物，服务器不需要前端
#
# 用法：
#   bash scripts/pack-deploy.sh              # 默认：源码+配置+init SQL+data(music/image/lyric)+6 个核心 jar
#   bash scripts/pack-deploy.sh --all-jars   # 额外追加 Mod_setting + Mod_media 的 jar（跑全量 8 服务时用）
#   bash scripts/pack-deploy.sh --no-jars    # 不打任何 jar（服务器上自己 mvn package 时用）
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="musicdreamer-deploy-$STAMP.tar.gz"

CORE_SVCS="gateway Mod_login Mod_music Mod_upload Mod_songList Mod_like"
EXTRA_SVCS="Mod_setting Mod_media"

MODE="core"   # core | all | none
for arg in "$@"; do
  case "$arg" in
    --all-jars) MODE="all" ;;
    --no-jars)  MODE="none" ;;
    *) echo "未知参数: $arg（支持 --all-jars / --no-jars）"; exit 1 ;;
  esac
done

# 收集要显式追加的 jar（显式操作数不受 --exclude 影响，直接落进包内原路径，
# 与 Dockerfile.service 的 COPY ${SVC}/target/*.jar 对齐）
JARS=()
if [ "$MODE" != "none" ]; then
  SVCS="$CORE_SVCS"
  [ "$MODE" = "all" ] && SVCS="$CORE_SVCS $EXTRA_SVCS"
  for dir in $SVCS; do
    for j in MusicDreamer-backend/$dir/target/*.jar; do
      # 跳过 .original（spring-boot repackage 前的薄 jar）和 common 这类库 jar
      [ -e "$j" ] || continue
      case "$j" in *.jar.original) continue ;; esac
      JARS+=("$j")
    done
  done
fi

echo "==> 打包 $ROOT -> $OUT"
TAR_ARGS=(
  --exclude='tools'
  --exclude='*/target'
  --exclude='.git'
  --exclude='.idea'
  --exclude='node_modules'
  --exclude='dist'
  --exclude='data/models'
  --exclude='data/task'
  --exclude='docker-extras'
  --exclude='*.log'
  --exclude='.playwright-cli'
)

# 两步打包：tar 的 --exclude 连显式操作数也过滤，所以 jar 用不带排除的第二趟 -rf 追加。
# 第二趟从项目根以相对路径传 jar，包内路径正好是 MusicDreamer-backend/<SVC>/target/*.jar，
# 与 Dockerfile.service 的 COPY ${SVC}/target/*.jar 对齐。
# 用 tar+gzip 管道拆开而非 -z：Git Bash 下 tar 内部 exec gzip 会因 PATH 传递失败（"Cannot exec"）
TAR_TMP="$(mktemp -u).tar"
trap 'rm -f "$TAR_TMP"' EXIT
tar -cf "$TAR_TMP" "${TAR_ARGS[@]}" \
  MusicDreamer-backend MusicDreamer-frontend scripts

if [ "$MODE" != "none" ] && [ ${#JARS[@]} -gt 0 ]; then
  tar -rf "$TAR_TMP" "${JARS[@]}"
fi

gzip -c "$TAR_TMP" > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
N_JARS=${#JARS[@]}
echo "==> 完成: $ROOT/$OUT ($SIZE, 含 $N_JARS 个 jar)"
echo "    上传: scp $OUT user@server:~/"
echo "    服务器上: tar xzf $OUT && cd MusicDreamer-backend && docker compose -f docker-compose.prod.yml up -d"
