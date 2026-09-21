# 悦享音乐 MusicDreamer

微服务架构音乐平台：播放 / 歌单 / 社区 + **自研 Shazam 式听歌识曲** + **AI 三级降级歌词链路**，全量 Docker Compose 编排，可在 2G 内存服务器极限运行。

> 运行方式：本地 / 私有服务器 Docker Compose 部署
> 技术栈：Spring Cloud Gateway · Nacos · OpenFeign · Spring Boot 3 · MySQL · Redis · JWT · Docker Compose · 微信小程序

## 核心特性

### 1. 微服务基座（1 网关 + 7 服务）
- Nacos 注册配置中心，OpenFeign + fallback 服务间调用
- 网关**身份头清洗防伪造** + 认证地板：改密后旧 token 立即失效
- Redis 全操作**降级不阻断主链路**（缓存故障时核心功能可用）
- Docker Compose 2G 内存服务器极限编排

### 2. 媒体任务引擎
- DB 任务表作为**唯一事实源**，状态机单向流转
- `UPDATE` 条件原子抢占，防多 worker 重复消费
- 外部进程调用统一出口：数组参数防注入 / 超时 destroyForcibly / stderr 守护线程
- 服务重启自愈 + WebSocket 实时进度推送

### 3. 听歌识别（自研 Shazam 式音频指纹）
```
PCM 解码 → STFT(手写 radix-2 FFT) → 谱峰提取(均值+1.2σ 自适应阈值)
       → anchor-target 指纹哈希 → 倒排索引入库 → 帧偏移投票定位
```
- 实测：同曲 435 票 / 异曲 5 票；命中双门槛（票数 ≥25 且占比 ≥10%）
- 本地未命中才降级 ACRCloud 云识别（手写 HmacSHA1 签名），识别结果预填求歌闭环

### 4. AI 歌词链路（三级降级）
```
LRCLIB 在线词库 → 来源视频 CC 字幕 → whisper.cpp 本地转写
```
- 在线歌词 × 本地转写**逐句校准**：单调配对 + 时间窗防副歌错配 + 分段偏移插值
- 纯文本歌词区间 DP 配对拆句挂时间轴；LRC 解析 + 繁转简全链路

## 架构

```
                    ┌──────────────────┐
  微信小程序 / Web ──▶  Gateway 网关      │
                    │ (身份头清洗/鉴权) │
                    └────────┬─────────┘
              ┌──────┬───────┼────────┬───────┐
         ┌────▼──┐ ┌─▼────┐ ┌▼─────┐ ┌▼─────┐ ┌▼──────┐
         │ login │ │music │ │media │ │ like │ │songList│  ...7 服务
         └───────┘ └──────┘ └──────┘ └──────┘ └────────┘
              Nacos 注册/配置 · OpenFeign + fallback
                    │                │
              ┌─────▼─────┐   ┌──────▼──────┐
              │ MySQL 集群 │   │ Redis(可降级)│
              └───────────┘   └─────────────┘
  media 内置任务引擎: DB任务表状态机 + ffmpeg/whisper.cpp 外部进程
```

## 快速开始

```bash
cd MusicDreamer-backend
# 拉取媒体工具（ffmpeg / whisper.cpp 模型等，清单见 tools.manifest.json，二进制不入库）
node scripts/fetch-tools.js

# 一键启动（MySQL/Nacos/7个微服务全量容器化）
./docker-up.cmd          # Windows
docker compose up -d     # 或直接使用 docker-compose.yml
```

## 目录结构

```
├── MusicDreamer-backend/        # Spring Cloud 微服务（1网关+7服务+公共模块）
│   ├── gateway/                 # 网关：身份头清洗、认证地板
│   ├── Mod_media/               # 媒体任务引擎 + 听歌识曲 + 歌词链路
│   ├── Mod_login/  Mod_music/   # 登录 / 音乐 / 点赞 / 歌单 / 上传 / 设置
│   ├── common/                  # 通用工具与响应封装
│   ├── init/                    # 数据库初始化脚本
│   └── docker-compose.yml       # 全量容器化编排（2G 服务器可跑）
├── MusicDreamer-frontend/       # Web 前端
├── MusicDreamer-miniprogram/    # 微信小程序端
├── scripts/                     # 运维脚本（Nacos 启停、Flyway 修复）
└── docs/                        # 需求规格 / 详细设计 / 部署手册
```

## 联系方式

- GitHub: [dkkfdjf](https://github.com/dkkfdjf)
- 邮箱: 19574486919@163.com
