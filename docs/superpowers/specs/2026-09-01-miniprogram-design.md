# MusicDreamer 微信小程序设计文档

日期：2026-09-01
状态：已与用户确认

## 1. 目标与范围

为已上线的 MusicDreamer 音乐平台后端（106.55.3.235，网关 8080 / nginx 80）开发**原生 TypeScript 微信小程序**，覆盖**纯听歌用户**的核心功能。不做歌手上传、不做管理端、不做评论/举报/个人设置编辑/微信登录（用户明确排除）。

功能清单（对齐网页端用户侧）：

| 模块 | 功能 |
|---|---|
| 账号 | 账密登录、注册（用户名/昵称/邮箱/密码）、找回密码（用户名+邮箱+新密码重置）、退出登录 |
| 发现（首页） | 个性化推荐列表、飙升榜、热歌榜、点歌播放、收藏 |
| 广场 | 歌曲搜索（关键词分页）、按曲风/语言浏览、公开歌单列表、公开专辑列表 |
| 播放 | 播放页：进度条拖拽、播放/暂停/上一首/下一首、播放模式（顺序/单曲循环/随机）、歌词同步滚动、收藏、播放上报 |
| 最近播放 | 最近播放列表、播放历史明细分页 |
| 音乐库 | 收藏的歌曲列表、我创建的歌单、我收藏的歌单、创建歌单、歌单详情（播放全部/收藏歌单/主人加歌删歌删歌单） |
| 我的 | 用户信息展示（昵称/头像/角色）、退出登录 |

不做：评论、举报、个人资料编辑、微信登录入口、上传/导入、听歌识曲、管理端。

## 2. 技术方案

- **原生微信小程序 + TypeScript**，微信开发者工具直接打开（`project.config.json` + `tsconfig.json` 齐备，编译用工具内置的 tsc 插件）。
- **音频**：`wx.getBackgroundAudioManager()` 全局单例（应用级 service，不挂在页面里），支持锁屏/后台播放、系统播放器封面与控制。 要求 `requiredBackgroundModes: ["audio"]`。
- **状态管理**：轻量 pub/sub（自写 ~30 行 `store.ts`），player 状态（当前歌、队列、播放模式、进度）与 auth 状态（token、user）独立模块，页面 onShow 订阅刷新。
- **单包**：页面总量 8 个左右，无需分包。

### 目录结构

```
MusicDreamer-miniprogram/
├── project.config.json      # appid 占位、TS 编译配置
├── tsconfig.json
├── typings/                 # 小程序类型声明
├── app.json / app.ts / app.wxss
├── config.ts                # BASE_URL = http://106.55.3.235/api/v1
├── services/
│   ├── api.ts               # 全部后端接口封装（wx.request Promise 化）
│   ├── auth.ts              # token/user 存取（wx.setStorageSync）、登录态
│   ├── player.ts            # 全局播放器：队列/模式/进度/上报/歌词
│   ├── store.ts             # 通用 pub/sub
│   └── lrc.ts               # LRC 歌词解析
├── components/
│   ├── song-item/           # 歌曲行（封面/歌名/歌手/收藏心/更多→加入歌单）
│   └── mini-player/         # 全局迷你播放条（所有非播放页底部）
├── pages/
│   ├── login/               # 登录 + 注册 + 找回密码（三态切换，一个页面）
│   ├── home/                # tab1 首页：推荐 + 飙升榜 + 热歌榜
│   ├── square/              # tab2 广场：搜索/曲风筛选歌曲 + 公开歌单 + 公开专辑（三段 tab）
│   ├── library/             # tab3 音乐库：收藏歌曲 / 我的歌单 / 收藏的歌单（三段 tab）
│   ├── mine/                # tab4 我的：用户信息 + 退出登录
│   ├── playlist/            # 歌单/专辑共用详情页（type 参数区分）：播放全部/收藏/主人管理（加歌用半屏搜索）
│   └── playing/             # 播放页：大封面/进度/歌词/控制/收藏
└── utils/
```

tabBar 四个：首页 / 广场 / 音乐库 / 我的。播放页为普通页面（`navigateTo`），mini 播放条悬浮于 tab 页与非 tab 页底部。

## 3. 关键设计

### 3.1 API 层（services/api.ts）

- 把网页端 `api/index.js` 的用户侧接口移植为 TS，**只保留本设计用到的接口**。
- `wx.request` Promise 封装；请求头自动带 `Authorization: Bearer <token>`。
- 响应约定：`{code, message, data}`，`code===0` 返回 `data`；`code===2006` 或 HTTP 401 → 清空登录态、跳转登录页。
- `BASE_URL` 在 `config.ts`：`http://106.55.3.235/api/v1`（开发者工具勾选"不校验合法域名"即可联调；后续正式域名需 HTTPS）。
- 静态资源（封面/音频/歌词 URL）：后端返回 `/data/...` 相对路径时拼 `http://106.55.3.235` 前缀。
- 接口清单（本设计用到的全部）：
  - 账号：`POST /user/register`、`POST /user/login`、`POST /user/password/reset`、`GET /user/info`、`POST /user/logout`
  - 歌曲：`GET /song/chart?type=hot|rise`、`GET /song/detail/{id}`、`GET /song/play/{id}`、`GET /search/songs`、`GET /search/by-style`、`GET /search/styles`
  - 推荐：`GET /recommend/list`
  - 播放记录：`GET /music/recent`、`GET /music/history`、`POST /music/playReport`
  - 歌单：`GET /playlist/public/list`、`GET /playlist/{id}`、`GET /playlist/my`、`POST /playlist/create`、`PUT /playlist/update/{id}`、`DELETE /playlist/{id}`、`POST /playlist/{id}/songs`、`DELETE /playlist/{id}/songs/{songId}`、`POST /playlist/{id}/favorite`、`DELETE /playlist/{id}/favorite`
  - 专辑：`GET /album/public/list`、`GET /album/{id}`（详情页与歌单共用：`playlist?id=x&type=album`，加歌入口对专辑隐藏）
  - 收藏：`GET /collect/list`、`GET /collect/ids`、`POST /collect/add`、`DELETE /collect/{songId}`

### 3.2 全局播放器（services/player.ts）

- 基于 `wx.getBackgroundAudioManager()`；`title` 必填（iOS 后台播放要求）。
- 状态：`queue: Song[]`、`index`、`mode: order|single|random`、`playing`、`currentTime`、`duration`、`curSong`。
- `playQueue(songs, index)` 整列表入队；点击任意歌曲行默认以"所在列表"入队播放。
- `next()/prev()`：按模式计算下一曲（random 随机不重复到队尾前；single 用 `onEnded` 重播）。
- 播放流程：`GET /song/play/{id}` 取 `fileUrl` → 拼 CDN 前缀 → 赋给 manager；封面/歌名同步给系统播放器。
- **播放上报**：与网页端一致——播满 30 秒或播放过半时 `POST /music/playReport {songId, playDuration}` 一次；切歌/停止时若上一首满足条件且未报则补报。
- **歌词**：`GET /song/play/{id}` 返回 `lyricUrl` → 下载 LRC → `lrc.ts` 解析为 `[{time, text}]` → `onTimeUpdate` 二分查找当前行，通知播放页滚动。无歌词时显示"暂无歌词"。
- 进度条：`onTimeUpdate` 节流（500ms）通知订阅者；拖动用 `seek()`。

### 3.3 登录态（services/auth.ts）

- `wx.setStorageSync('md_token' | 'md_user')`；`app.ts` 启动时读取。
- 登录成功存 `token + user`（`LoginVO: {token, userId, nickname, avatar, role}`）。
- api 层收到 2006/401 时清空并 `wx.reLaunch` 到登录页。
- 未登录时：tab 页数据仍可浏览（榜单/搜索/广场为匿名白名单接口），点收藏/进音乐库/我的时提示登录。歌单详情公开歌单匿名可看。

### 3.4 组件

- `song-item`：属性 `song`、`index`、`playing`（高亮当前播放）、`showCollect`；点行=播放（整列表入队），心形=收藏切换，"…"=弹出 action sheet 加入已有歌单（`GET /playlist/my` + 选择 + `POST /playlist/{id}/songs`）。
- `mini-player`：固定底部条，显示当前歌封面/歌名/播放暂停/下一首，点主体 `navigateTo` 播放页；无歌时隐藏。

### 3.5 错误处理

- api 层失败：`wx.showToast({title: message, icon: 'none'})`，统一在一个地方弹。
- 网络错误：统一文案"网络错误，请稍后重试"。
- 登录过期：静默清态后 reLaunch 登录页（避免连环 toast）。

## 4. 数据流示例（点一首歌）

1. 首页列表 `bindtap` → `player.playQueue(chartSongs, 3)`
2. player 调 `api.songPlay(id)` 拿 fileUrl → 拼 URL → `manager.src = url; manager.title = 歌名`
3. `onTimeUpdate` → 更新 store.currentTime → 播放页进度条 & 歌词滚动、mini 播放条不动
4. 播满 30s → 上报一次 → `GET /music/recent` 缓存可标脏（回到最近播放页 onShow 重新拉）
5. `onEnded` → 按模式 `next()` 自动续播

## 5. 测试计划

小程序无法跑常规单测（不引测试框架，保持简单），采用**真机/工具手测清单**：

1. 注册 → 登录 → 退出 → 重新登录（含找回密码路径）
2. 首页三个榜单出数据、点歌即播、收藏心同步
3. 广场搜索关键词分页、曲风筛选、公开歌单/专辑打开详情
4. 播放页：进度拖拽、上下首、三种模式切换、歌词滚动（选有 LRC 的歌）、后台/锁屏继续播放
5. 音乐库：建歌单 → 歌单加歌/删歌 → 收藏/取消收藏歌单 → 删除歌单；收藏歌曲列表同步
6. 最近播放：播过的歌出现且去重按最新排序
7. 未登录点收藏/音乐库 → 引导登录；token 过期自动回登录页
8. 管理员账号（admin）登录不出现用户端异常即可（不做管理功能）

## 6. 明确不做（YAGNI）

分包、 评论、举报、上传/链接导入、听歌识曲、管理端页面、微信登录、个人资料编辑、uni-app/Taro、测试框架、音频可视化。
