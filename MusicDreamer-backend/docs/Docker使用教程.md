> 本文件为仓库内正式副本（2026-08-28 复制自仓库外 docs/，后续修改以这份为准）。

# MusicDreamer Docker 使用教程（零基础版）

> 适用：装了 Docker Desktop 但没用过的人。项目仓库 `backend/docker-compose.yml` 是现成的"清单"，照本文命令做即可。
> 2026-08-24 版：compose 已修复 nacos 9848 端口映射与容器 MYSQL_PASSWORD；init.sql 已移除演示数据（仅保留 admin/admin123），拉最新代码后本文全部有效。
> **2026-08-28 版（重要变更）**：① 容器 MySQL/Redis 改映射宿主机 **3307/6380**——**不用再停本机 MySQL/Redis**（只停本机 Nacos 即可，8848 仍冲突）；② 修复 compose 未给各服务传 `SVC` 构建参数的 bug（此前 8 个镜像会全部打成 gateway）；③ 网关补 `NACOS_ADDR/REDIS_HOST`；④ `mod-media/mod-upload` 直接挂宿主机 `backend/data`（上传/媒体文件与 IDEA 模式共用），并设 `STORAGE_ROOT=/data`；⑤ mod-media 的 yt-dlp 改用 `docker-extras/yt-dlp_linux`（Linux 版，仓库外文件，见下文 B 段）；⑥ 全部服务已实测跑通（登录/歌单/播放/收藏写库）。

## 这个项目里 Docker 是干嘛的

三件事被打包管理：**MySQL 8 / Redis 6 / Nacos 2.2.3**（官方镜像直接拉）+ **8 个后端微服务**（各自 jar 塞进 JRE17 镜像）。`docker-compose.yml` 描述"要哪些容器、怎么互联"，Docker Desktop 负责拉取/构建/启动。

两种玩法：
- **玩法 A（基础设施模式）**：只用 Docker 起 MySQL/Redis/Nacos 三个环境件，业务服务仍在 IDEA 里跑。适合日常开发、也是新队友的标准路径。
- **玩法 B（全量打包模式）**：所有东西全部容器化一条命令起。适合课程演示"整个系统打包部署"。

## 准备（一次性）

1. 开始菜单搜 **Docker Desktop** 点开，等右下角鲸鱼图标稳定（首次 1~2 分钟）。
2. 终端验证：`docker version`——Client 和 Server 都显示版本 = 引擎就绪。
3. 确认 **C 盘剩余 ≥ 5GB**（镜像与数据默认存在 C 盘 WSL 虚拟磁盘里）。

## 玩法 A：Docker 起基础设施 + IDEA 跑服务

### A0 只需停本机 Nacos（3307/6380 已与本机错开）

| 要停的 | 怎么停 |
|---|---|
| ~~MySQL / Redis~~ | **不用停**——容器映射的是宿主机 3307/6380，与本地 3306/6379 不冲突 |
| Nacos | 关掉 nacos-start 那个命令行窗口（8848 仍冲突） |

### A1 起容器

```bat
cd /d D:\Desktop\MusicDreamer\backend
docker compose up -d mysql redis nacos
```

首次自动拉镜像（mysql ~150MB、redis ~30MB、nacos ~250MB），网慢耐心等。完成后 `docker compose ps`，等 STATUS 变 **(healthy)**（nacos 约 15~60 秒）。宿主机连容器库用 `127.0.0.1:3307`（root/123456）。

### A2 IDEA 里设环境变量再起服务（关键！）

docker 这份 MySQL 的 root 密码是 **123456**、端口 **3307**；容器 Redis 在 **6380**。在 IDEA 每个服务的 Run Configuration → Environment variables 加：

```
MYSQL_PASSWORD=123456;MYSQL_PORT=3307;REDIS_PORT=6380
```

**不要设成系统环境变量**——切回本机 MySQL 时会忘删，连库又失败。只在 IDEA 运行配置里加，用完删。

照常启动 8 个服务。验证：浏览器开 `http://localhost:8848/nacos`（如需登录默认 nacos/nacos），能看到服务注册上来。

> 注意：docker 的 MySQL 是**全新库**，只有 init/init.sql 的表结构和默认 admin 账号（admin/admin123）——没有演示歌曲，你本机传的歌、建的账号也不在里面。这正是"新队友看到的世界"，歌要重新传。

### A3 用完还原

```bat
docker compose stop mysql redis nacos   & :: 容器保留，下次 start 秒起
net start MySQL80                        & :: 本机 MySQL 回来
```

Redis 重新启动、双击 `scripts\nacos-start.cmd`。docker 库的数据保留在 mysql_data 卷里；想彻底清掉重来：`docker compose down -v`（**-v 会删数据卷，慎用**）。

## 玩法 B：全量打包（演示用）

### 一键脚本（推荐，免敲命令）

backend 根目录有三个双击即用的脚本：

- **`docker-up.cmd`**：一键启动全栈——Docker 没开会自动拉起 Desktop、起 11 个核心容器、轮询等 8 个服务全部注册进 Nacos、5173 空闲时自动新窗口开前端 vite，最后打印访问地址。**日常演示双这个就行。**
- **`docker-down.cmd`**：一键停止（数据保留，再双 docker-up 秒级恢复）。
- **`docker-rebuild.cmd`**：改了 Java 代码后用——自动 Maven 打包（内置 JDK 路径）+ 只重建 jar 有变化的镜像并滚动更新。

两个注意：脚本起的是核心 11 容器（监控组仍按下文手动起）；两种玩法**二选一**——docker-up 报 8848 被占用 = 本机 Nacos（玩法 A/IDEA）还开着，先停它。

### 手动命令（理解原理用）

```bat
cd /d D:\Desktop\MusicDreamer\backend
tools\apache-maven-3.9.16\bin\mvn.cmd -s tools\settings.xml -DskipTests package   & :: 先出全部 jar（或 IDEA 里 package）
docker compose up -d --build mysql redis nacos gateway mod-login mod-music mod-upload mod-songlist mod-like mod-setting mod-media   & :: 构建并启动（不带监控）
```

**前置**：`backend/docker-extras/yt-dlp_linux`（约 35MB，Linux 版 yt-dlp；`tools/bin/yt-dlp.exe` 是 Windows 版，容器里跑不了）。没有就先下一份：

```bat
curl -L -o docker-extras\yt-dlp_linux https://ghfast.top/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
```

首次较慢：拉 JRE17 基础镜像 + 逐模块建镜像，mod-media 还要装 ffmpeg（已配阿里 apt 源），国内网络 10~30 分钟。之后重启秒级。

- `docker compose ps` 看全部容器（3 基础设施 + 8 业务；监控组按需 `docker compose up -d prometheus grafana alertmanager sentinel-dashboard`）
- 前端照常 `npm run dev`（代理指向 8080 不变，网关容器已映射 8080）
- Nacos 控制台 `http://localhost:8848/nacos` 看 8 个服务注册
- Grafana `http://localhost:3001`（admin/admin）
- 看某个服务日志（排错主要靠它）：`docker compose logs -f mod-music`（Ctrl+C 退出查看）
- 收尾：`docker compose down`（容器删除，数据卷保留）
- 已灌入真实数据（账号/歌曲与开发库一致）；重置回全新库：`docker compose down` 后 `docker volume rm backend_mysql_data` 再 up

## 常见坑速查

| 现象 | 原因/解法 |
|---|---|
| port is already allocated / bind failed | 玩法 A 检查本机 Nacos 是否还开着（8848 冲突）；MySQL/Redis 已用 3307/6380 错开一般不会再撞 |
| 服务连库失败 | 玩法 A 忘设 `MYSQL_PASSWORD=123456;MYSQL_PORT=3307`（IDEA 配置里加）；玩法 B 已在 compose 里配好 |
| daemon is not running | Docker Desktop 没启动完成，等鲸鱼图标稳定 |
| 拉镜像 403/EOF/卡住 | 2026-08-28 实测：163 旧源已死、1panel 要登录、1ms 大层必断，**直连官方源反而能过**（daemon.json 的 registry-mirrors 已清空）。配合重试：`for /l %i in (1,1,8) do docker pull mysql:8.0 && goto :ok`（多试几轮，层有缓存） |
| 容器起来了但服务不注册/网关 503 | compose 里该服务的 `NACOS_ADDR: nacos:8848` 环境变量丢了（8-28 已修，别删） |
| 播放/图片 404 但列表正常 | `STORAGE_ROOT=/data` 环境变量或 sys_setting 的 storage_root 被改回 Windows 路径了（8-28 已修） |
| 关掉 Docker Desktop 后容器全没了 | 正常，容器随引擎停；重启 Docker Desktop 后 `restart: always` 会自动拉起，或手动 `docker compose up -d` |
| 引擎卡死（docker ps 都挂起） | 大招：`wsl --shutdown` 后重启 Docker Desktop（8-28 实测有效） |
