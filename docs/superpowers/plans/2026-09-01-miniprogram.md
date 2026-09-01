# MusicDreamer 微信小程序实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为已上线后端（106.55.3.235）构建原生 TypeScript 微信小程序，覆盖纯听歌用户全部功能（登录注册、搜索浏览、榜单推荐、歌单专辑、收藏、最近播放、全局播放器+歌词）。

**Architecture:** 原生小程序单包结构；`wx.getBackgroundAudioManager()` 应用级单例做全局播放（后台/锁屏可播）；自写 pub/sub store 做状态管理；services 层承载 api/auth/player/lrc 逻辑，pages 只做绑定。

**Tech Stack:** 微信原生小程序 + TypeScript（开发者工具内置编译）、WXML/WXSS，无 npm 依赖。

**设计文档:** `docs/superpowers/specs/2026-09-01-miniprogram-design.md`

## Global Constraints

- 后端 BASE：`http://106.55.3.235/api/v1`；静态资源前缀 `http://106.55.3.235`（后端返回 `/data/...` 相对路径时拼接）
- 响应外层统一 `{code, message, data}`；`code===0` 成功；`code===2006` 或 HTTP 401 = 登录过期 → 清登录态 reLaunch 到 `/pages/login/login`
- 所有请求带 `Authorization: Bearer <token>`（有 token 时）
- 小程序项目根目录：`C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram`（下文相对路径均基于此）
- 无 npm 依赖；TS 由微信开发者工具内置 tsc 编译（`useCompilerPlugins: ["typescript"]`），提交 .ts 源码即可
- UI 主题：暖灰纸底 `#f1eee8`、卡面 `#fffefa`、品牌橙 `#ff6b1a`、辅青 `#0699b8`、正文 `#3d3a35`、次级文字 `#8a857c`、圆角 16rpx 体系
- 小程序 rpx：750rpx = 屏宽；代码注释用中文，与网页端一致
- 页面标题统一前缀「悦享音乐 · 」
- **测试方式**：本计划无测试框架（设计文档 YAGNI 决定）。每个任务的可验证交付 = ① `npx tsc --noEmit` 类型检查通过（在 miniprogram 目录跑，typings 由任务 1 建立）② 逻辑函数用 `node` 直接跑断言（纯函数：lrc 解析、url 拼接、上报判定）③ 页面/组件以编译通过+代码走查为验收，整体联调在任务 9 用 curl 冒烟 + 用户在开发者工具真机预览
- git 仓库已初始化在 `C:\Users\34392\Desktop\项目3`；每个任务提交一次

## 后端接口与数据结构备忘（实现时对照）

统一返回 `{code, message, data}`。关键 data 结构（已从后端源码核实）：

```ts
// 登录 POST /user/login  body {username,password,remember}
LoginVO: {token, userId, nickname, avatar, role}   // role: 0用户 1歌手 2管理员
// 注册 POST /user/register  body {username,nickname,email,password}
// 找回 POST /user/password/reset body {username,email,newPassword}
// 用户信息 GET /user/info
UserVO: {id, username, email, nickname, avatar, role, singerStatus, status, createTime}
// 榜单 GET /song/chart?type=hot|rise&limit=20  → SongCardVO[]
// 推荐 GET /recommend/list?limit=10 → SongCardVO[]（匿名返回热榜兜底）
SongCardVO: {id, name, singer, singerId, album, style, duration, coverUrl, playCount, weekPlayCount, score}
// 播放数据 GET /song/play/{id}
SongPlayVO: {songId, name, singer, singerId, album, fileUrl, coverUrl, lyricUrl, duration, volumeGain, fileFormat}
// 详情 GET /song/detail/{id} → SongDetailVO（songId/name/singer/singerName/.../status）
// 搜索 GET /search/songs?keyword=&page=&size= → {total, songs: SongCardVO[]}
// 曲风 GET /search/styles → string[]
// 浏览 GET /search/by-style?style=&language=&page=&size= → {total, songs: SongCardVO[]}
// 最近播放 GET /music/recent?limit=10 → RecentVO[]
RecentVO: {songId, name, singer, album, coverUrl, duration, lastPlayedAt}
// 历史 GET /music/history?page=&size= → {total, records: [{id,songId,songName,coverUrl,singer,playDuration,playComplete,deviceType,playedAt}]}
// 上报 POST /music/playReport body {songId, playDuration}
// 歌单广场 GET /playlist/public/list?page=&size=&keyword= → {total,pages,page,size,records: PlaylistVO[]}
// 专辑广场 GET /album/public/list?同上 → 同结构（singerName 代替 creatorName）
PlaylistVO: {id, userId, name, description, coverUrl, isPublic, createTime, songCount, favoriteTime, creatorName}
// 歌单详情 GET /playlist/{id}（私有仅创建者可见）
PlaylistDetailVO: {id, userId, name, description, coverUrl, isPublic, createTime, updateTime, songCount, favored, songs: PlaylistSongVO[], creatorName}
// 专辑详情 GET /album/{id} → AlbumDetailVO = PlaylistDetailVO 同构（多 updateTime/singerName）
PlaylistSongVO: {songId, sortOrder, addTime, name, singerId, singerName, coverUrl, duration, style, album, status}
// 我的歌单 GET /playlist/my → {created: PlaylistVO[], favorited: PlaylistVO[]}
// 创建 POST /playlist/create body {name, description?, isPublic?} ；改 PUT /playlist/update/{id} body {name?, description?, isPublic?, coverUrl?}
// 删歌单 DELETE /playlist/{id}；加歌 POST /playlist/{id}/songs body {songId}；删歌 DELETE /playlist/{id}/songs/{songId}
// 收藏歌单 POST /playlist/{id}/favorite；取消 DELETE /playlist/{id}/favorite
// 收藏歌曲 POST /collect/add body {songId}；取消 DELETE /collect/{songId}
// 列表 GET /collect/list?page=&size=&singer=&style= → {total, page, size, records: CollectItemVO[]}
// ids GET /collect/ids → number[]
CollectItemVO: {songId, collectTime, name, singerId, singerName, coverUrl, duration, style, album, status}
```

网关鉴权（决定哪些页面未登录也能看）：
- 匿名：login/register/reset、/search/**、/song/play、/song/detail、/song/chart、/comment/**、/recommend/list、/data/**
- 可匿名可登录（OPTIONAL）：/playlist/public/**、/playlist/{id}、/album/public/**、/album/{id}
- 其余全部需要 token

---

### Task 1: 项目骨架 + 全局配置

**Files:**
- Create: `project.config.json`、`tsconfig.json`、`typings/index.d.ts`、`typings/types/wx/lib.wx.api.d.ts`（用 miniprogram-api-typings 的精简自备版，或直接从微信官方模板拷；plan 里给自写最小声明，保证 tsc 不报错）、`app.json`、`app.ts`、`app.wxss`、`config.ts`、`utils/format.ts`
- Create: 占位页面目录（Task 2-7 填充）：`pages/login/`、`pages/home/`、`pages/square/`、`pages/library/`、`pages/mine/`、`pages/playlist/`、`pages/playing/`（每个先放最小 `.ts/.wxml/.wxss/.json` 四件套，wxml 只有 `<view>{{'页面名'}}</view>`）

**Interfaces:**
- Produces: `config.ts` 导出 `BASE_URL: string`、`STATIC_BASE: string`、`resolveUrl(url?: string|null): string`（`/data/...` → `STATIC_BASE + url`；`http(s)://` 开头原样返回；空返回 `''`）
- Produces: `utils/format.ts` 导出 `fmtDuration(sec?: number|null): string`（`"3:45"` 格式，空/0 → `--:--` 或 `0:00`）
- Produces: `app.json` 注册全部 7 页面 + tabBar 4 项（icon 先不放图片文件，tabBar 用无 icon 的纯文字模式需要 `custom: false` 且不配 icon 字段——微信允许 tabBar 项不配 icon；若校验不过则用 1px 占位 png，base64 写入脚本生成）+ `requiredBackgroundModes: ["audio"]` + 全局导航栏底色 `#f1eee8` 标题色黑

- [ ] **Step 1: 建目录与 project.config.json / tsconfig.json**

`project.config.json`（appid 占位，用户导入时改）：

```json
{
  "description": "MusicDreamer 悦享音乐小程序",
  "packOptions": { "ignore": [], "include": [] },
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true,
    "useCompilerPlugins": ["typescript"]
  },
  "compileType": "miniprogram",
  "libVersion": "2.33.0",
  "appid": "touristappid",
  "projectname": "MusicDreamer-miniprogram",
  "editorSetting": { "tabIndent": "insertSpaces", "tabSize": 2 }
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "removeComments": true,
    "typeRoots": ["./typings"],
    "lib": ["ES2020"]
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: 写 typings（最小可用的 wx 全局声明）**

`typings/index.d.ts` 必须覆盖本计划用到的全部 wx API 与 Page/App/Component/Behavior 构造器。用最小但类型正确的声明（不要 any 泛滥，`IAnyObject = Record<string, any>` 兜底）：

```ts
// typings/index.d.ts
type IAnyObject = Record<string, any>
type IAnyFunction = (...args: any[]) => any
declare const wx: any
declare const getApp: () => any
declare function Page(options: IAnyObject): void
declare function Component(options: IAnyObject): void
declare function App(options: IAnyObject): void
declare function Behavior(options: IAnyObject): void
declare const getCurrentPages: () => any[]
```

说明：如果本机能 `npm i -D miniprogram-api-typings` 且网络允许，优先用它（tsconfig typeRoots 换成 `["./node_modules/@types"]` + `"types": ["miniprogram-api-typings"]`）；装不了就用上面的最小声明（plan 默认路径，保证离线可完成）。**默认按最小声明走**，所有 options 内部字段用字面量对象直接写。

- [ ] **Step 3: 写 config.ts 与 utils/format.ts**

```ts
// config.ts
// 后端地址：开发者工具需勾选「不校验合法域名」
export const STATIC_BASE = 'http://106.55.3.235'
export const BASE_URL = STATIC_BASE + '/api/v1'

/** 后端返回的 /data/... 相对路径 → 完整 URL；已是 http(s) 原样返回 */
export function resolveUrl(url?: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return STATIC_BASE + url
}
```

```ts
// utils/format.ts
/** 秒 → m:ss；空值 → '--:--' */
export function fmtDuration(sec?: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
```

- [ ] **Step 4: 写 app.json（注册页面/tabBar/权限）与 app.wxss（主题变量+公共样式）**

`app.json`：

```json
{
  "pages": [
    "pages/home/home",
    "pages/square/square",
    "pages/library/library",
    "pages/mine/mine",
    "pages/login/login",
    "pages/playlist/playlist",
    "pages/playing/playing"
  ],
  "window": {
    "navigationBarBackgroundColor": "#f1eee8",
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "悦享音乐",
    "backgroundColor": "#f1eee8",
    "backgroundTextStyle": "dark"
  },
  "tabBar": {
    "color": "#8a857c",
    "selectedColor": "#ff6b1a",
    "backgroundColor": "#fffefa",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/home/home", "text": "首页" },
      { "pagePath": "pages/square/square", "text": "广场" },
      { "pagePath": "pages/library/library", "text": "音乐库" },
      { "pagePath": "pages/mine/mine", "text": "我的" }
    ]
  },
  "requiredBackgroundModes": ["audio"],
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

同时建 `sitemap.json`：`{ "desc": "关闭索引", "rules": [{ "action": "disallow", "page": "*" }] }`

`app.wxss`（主题令牌+通用卡片/列表样式）：

```css
/* 设计令牌：与网页端 RhythmoTune Daylight 同源 */
page {
  --bg: #f1eee8;
  --card: #fffefa;
  --brand: #ff6b1a;
  --cyan: #0699b8;
  --text: #3d3a35;
  --text-sub: #8a857c;
  --line: #e7e2d8;
  background: var(--bg);
  color: var(--text);
  font-size: 28rpx;
}
.card {
  background: var(--card);
  border-radius: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(93, 76, 60, 0.08);
}
.hairline { border-bottom: 1rpx solid var(--line); }
.ellipsis { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.btn-brand {
  background: linear-gradient(135deg, #ff6b1a, #e11d92);
  color: #fff;
  border-radius: 16rpx;
  font-weight: 600;
}
.btn-brand[disabled] { opacity: 0.5; }
```

- [ ] **Step 5: 写 app.ts（启动时恢复登录态并预热 collectIds）**

```ts
// app.ts
import { auth } from './services/auth'
App({
  onLaunch() {
    // 启动时从 storage 恢复登录态（token 过期由 api 层 2006 统一处理）
    auth.restore()
  }
})
```

（`services/auth` 在 Task 2 创建——本任务先建 `services/` 空目录，app.ts 会暂时报模块缺失，**为让本任务可编译，先提交一个空的 auth 占位** `services/auth.ts`：`export const auth = { restore() {} }`，Task 2 覆盖它。）

- [ ] **Step 6: 建 7 个页面的最小四件套 + mini-player/song-item 组件目录占位**

每个页面先写：`xxx.json`（`{"usingComponents": {}}`）、`xxx.ts`（`Page({})`）、`xxx.wxml`（`<view>页面名</view>`）、`xxx.wxss`（空）。`components/mini-player/`、`components/song-item/` 目录先空（后续任务填充）。

- [ ] **Step 7: 类型检查 + 纯函数断言**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出（0 错误）

Run（纯函数验证）:
```bash
cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc config.ts utils/format.ts --outDir /tmp/mdcheck --module commonjs --target es2020 && node -e "
const {resolveUrl} = require('/tmp/mdcheck/config.js');
const {fmtDuration} = require('/tmp/mdcheck/utils/format.js');
console.assert(resolveUrl('/data/music/a.mp3')==='http://106.55.3.235/data/music/a.mp3','resolveUrl rel');
console.assert(resolveUrl('https://x.com/a.jpg')==='https://x.com/a.jpg','resolveUrl abs');
console.assert(resolveUrl(null)==='','resolveUrl null');
console.assert(fmtDuration(225)==='3:45','fmtDuration 225');
console.assert(fmtDuration(null)==='--:--','fmtDuration null');
console.log('OK')"
```
Expected: `OK`

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 项目骨架——配置、主题、路由、7页面占位"
```

---

### Task 2: services 层——api / auth / store

**Files:**
- Create: `services/store.ts`、`services/auth.ts`（覆盖 Task 1 占位）、`services/api.ts`

**Interfaces:**
- Produces: `store.ts` → `createStore<T>(initial: T): { get(): T; set(patch: Partial<T>): void; subscribe(fn: (s: T) => void): () => void }`（set 浅合并 + 同步通知全部订阅者；subscribe 返回退订函数）
- Produces: `auth.ts` → `auth.restore(): void`、`auth.get(): {token: string, user: UserVO} | null`、`auth.getToken(): string`、`auth.isLoggedIn(): boolean`、`auth.save(token: string, user: object): void`、`auth.clear(): void`、`auth.requireLoginTip(): boolean`（未登录 toast「请先登录」并 `wx.navigateTo /pages/login/login`，返回 false；已登录返回 true）
- Produces: `api.ts` → `api.<method>`（下面 Step 3 全量列出签名）+ 导出 TS 类型 `SongCardVO`、`SongPlayVO`、`RecentVO`、`PlaylistVO`、`PlaylistDetailVO`、`PlaylistSongVO`、`CollectItemVO`、`UserVO`、`PageResult<T>`

- [ ] **Step 1: 写 services/store.ts（pub/sub）**

```ts
// services/store.ts
// 通用 pub/sub store：set 浅合并并同步通知订阅者；subscribe 返回退订函数
export function createStore<T extends object>(initial: T) {
  let state = { ...initial }
  const subs = new Set<(s: T) => void>()
  return {
    get(): T {
      return state
    },
    set(patch: Partial<T>): void {
      state = { ...state, ...patch }
      subs.forEach((fn) => fn(state))
    },
    subscribe(fn: (s: T) => void): () => void {
      subs.add(fn)
      return () => subs.delete(fn)
    }
  }
}
```

- [ ] **Step 2: 写 services/auth.ts（登录态存取）**

```ts
// services/auth.ts
// 登录态：wx storage 持久化；api 层遇 2006/401 时调 clear + reLaunch 登录页
import { resolveUrl } from '../config'

export interface UserVO {
  id: number
  username: string
  email: string
  nickname: string
  avatar: string
  role: number
}

const TOKEN_KEY = 'md_token'
const USER_KEY = 'md_user'

let token = ''
let user: UserVO | null = null

export const auth = {
  /** app 启动时从 storage 恢复 */
  restore(): void {
    try {
      token = wx.getStorageSync(TOKEN_KEY) || ''
      const u = wx.getStorageSync(USER_KEY)
      user = u ? { ...u, avatar: resolveUrl(u.avatar) } : null
    } catch (e) {
      token = ''
      user = null
    }
  },
  get(): { token: string; user: UserVO } | null {
    return token && user ? { token, user } : null
  },
  getToken(): string {
    return token
  },
  isLoggedIn(): boolean {
    return !!(token && user)
  },
  save(tk: string, u: any): void {
    token = tk
    user = { ...u, avatar: resolveUrl(u.avatar) }
    wx.setStorageSync(TOKEN_KEY, tk)
    wx.setStorageSync(USER_KEY, u)
  },
  clear(): void {
    token = ''
    user = null
    wx.removeStorageSync(TOKEN_KEY)
    wx.removeStorageSync(USER_KEY)
  },
  /** 未登录则提示并跳登录页；返回是否已登录 */
  requireLoginTip(): boolean {
    if (auth.isLoggedIn()) return true
    wx.showToast({ title: '请先登录', icon: 'none' })
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  }
}
```

- [ ] **Step 3: 写 services/api.ts（wx.request Promise 封装 + 全部接口）**

```ts
// services/api.ts
// 统一请求层：Promise 化 wx.request；code===0 解包 data；2006/401 清登录态回登录页
import { BASE_URL } from '../config'
import { auth } from './auth'

// ---------- 数据类型（与后端 VO 一一对应，见计划头部备忘） ----------
export interface SongCardVO {
  id: number
  name: string
  singer: string
  singerId: number
  album: string
  style: string
  duration: number
  coverUrl: string
  playCount: number
  weekPlayCount: number
  score: number
}
export interface SongPlayVO {
  songId: number
  name: string
  singer: string
  singerId: number
  album: string
  fileUrl: string
  coverUrl: string
  lyricUrl: string
  duration: number
  volumeGain: number
  fileFormat: string
}
export interface RecentVO {
  songId: number
  name: string
  singer: string
  album: string
  coverUrl: string
  duration: number
  lastPlayedAt: string
}
export interface PlaylistVO {
  id: number
  userId: number
  name: string
  description: string
  coverUrl: string
  isPublic: boolean
  createTime: string
  songCount: number
  favoriteTime: string
  creatorName: string
}
export interface PlaylistSongVO {
  songId: number
  name: string
  singerName: string
  singerId: number
  coverUrl: string
  duration: number
  style: string
  album: string
  status: number
}
export interface PlaylistDetailVO {
  id: number
  userId: number
  name: string
  description: string
  coverUrl: string
  isPublic: boolean
  createTime: string
  updateTime: string
  songCount: number
  favored: boolean
  songs: PlaylistSongVO[]
  creatorName: string
  singerName: string // 专辑详情时有
}
export interface CollectItemVO {
  songId: number
  name: string
  singerName: string
  singerId: number
  coverUrl: string
  duration: number
  style: string
  album: string
  status: number
}
export interface PageResult<T> {
  total: number
  records: T[]
}

interface RawRes {
  code: number
  message: string
  data: any
}

function request(method: string, path: string, data?: any, silent = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const header: IAnyObject = { 'content-type': 'application/json' }
    const tk = auth.getToken()
    if (tk) header.Authorization = 'Bearer ' + tk
    wx.request({
      url: BASE_URL + path,
      method: method as any,
      data,
      header,
      timeout: 15000,
      success: (res: any) => {
        const body = res.data as RawRes
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0) return resolve(body.data)
          // 登录过期：清态回登录页（静默请求不弹提示，避免连环 toast）
          if (body.code === 2006) {
            auth.clear()
            if (!silent) wx.showToast({ title: '登录已过期', icon: 'none' })
            wx.reLaunch({ url: '/pages/login/login' })
            return reject(new Error(body.message || '登录已过期'))
          }
          if (!silent) wx.showToast({ title: body.message || '请求失败', icon: 'none' })
          return reject(new Error(body.message || '请求失败'))
        }
        // 网关直接拒绝（无统一外层）
        if (res.statusCode === 401) {
          auth.clear()
          wx.reLaunch({ url: '/pages/login/login' })
          return reject(new Error('登录已过期'))
        }
        if (!silent) wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
        reject(new Error('HTTP ' + res.statusCode))
      },
      fail: (err: any) => {
        if (!silent) wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
        reject(new Error(err && err.errMsg))
      }
    })
  })
}

const get = (path: string, params?: IAnyObject, silent = false) => {
  const qs = params
    ? '?' +
      Object.keys(params)
        .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .map((k) => k + '=' + encodeURIComponent(params[k]))
        .join('&')
    : ''
  return request('GET', path + qs, undefined, silent)
}
const post = (path: string, data?: any) => request('POST', path, data || {})
const put = (path: string, data?: any) => request('PUT', path, data || {})
const del = (path: string) => request('DELETE', path)

export const api = {
  // ---------- 账号（匿名白名单接口） ----------
  register: (d: { username: string; nickname: string; email: string; password: string }) =>
    post('/user/register', d),
  login: (d: { username: string; password: string; remember?: boolean }) => post('/user/login', d),
  resetPassword: (d: { username: string; email: string; newPassword: string }) =>
    post('/user/password/reset', d),
  logout: () => post('/user/logout'),
  userInfo: () => get('/user/info'),
  // ---------- 歌曲/搜索/推荐（匿名） ----------
  songChart: (type: 'hot' | 'rise', limit = 20) => get('/song/chart', { type, limit }),
  songPlay: (id: number) => get(`/song/play/${id}`),
  songDetail: (id: number) => get(`/song/detail/${id}`),
  searchSongs: (keyword: string, page = 1, size = 20) => get('/search/songs', { keyword, page, size }),
  searchStyles: () => get('/search/styles'),
  searchByStyle: (params: { style?: string; language?: string; page?: number; size?: number }) =>
    get('/search/by-style', params),
  recommendList: (limit = 10) => get('/recommend/list', { limit }),
  // ---------- 播放记录（需登录） ----------
  playReport: (songId: number, playDuration: number) => post('/music/playReport', { songId, playDuration }),
  recentPlays: (limit = 20) => get('/music/recent', { limit }),
  playHistory: (page = 1, size = 20) => get('/music/history', { page, size }),
  // ---------- 歌单 ----------
  publicPlaylists: (params: { page?: number; size?: number; keyword?: string }) =>
    get('/playlist/public/list', params),
  playlistDetail: (id: number, silent = false) => get(`/playlist/${id}`, undefined, silent),
  myPlaylists: () => get('/playlist/my'),
  createPlaylist: (d: { name: string; description?: string; isPublic?: boolean }) =>
    post('/playlist/create', d),
  updatePlaylist: (id: number, d: { name?: string; description?: string; isPublic?: boolean }) =>
    put(`/playlist/update/${id}`, d),
  deletePlaylist: (id: number) => del(`/playlist/${id}`),
  addPlaylistSong: (id: number, songId: number) => post(`/playlist/${id}/songs`, { songId }),
  removePlaylistSong: (id: number, songId: number) => del(`/playlist/${id}/songs/${songId}`),
  favPlaylist: (id: number) => post(`/playlist/${id}/favorite`),
  unfavPlaylist: (id: number) => del(`/playlist/${id}/favorite`),
  // ---------- 专辑（广场+详情；详情与歌单同构） ----------
  publicAlbums: (params: { page?: number; size?: number; keyword?: string }) =>
    get('/album/public/list', params),
  albumDetail: (id: number, silent = false) => get(`/album/${id}`, undefined, silent),
  // ---------- 收藏歌曲（需登录） ----------
  collectAdd: (songId: number) => post('/collect/add', { songId }),
  collectRemove: (songId: number) => del(`/collect/${songId}`),
  collectList: (page = 1, size = 20) => get('/collect/list', { page, size }),
  collectIds: () => get('/collect/ids', undefined, true)
}

export default api
```

- [ ] **Step 4: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出（0 错误）

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): services 层——pub/sub store、登录态、统一 API 封装"
```

---

### Task 3: 全局播放器 player.ts + LRC 解析 lrc.ts

**Files:**
- Create: `services/lrc.ts`、`services/player.ts`
- Test: 纯函数用 node 断言（Step 4）

**Interfaces:**
- Consumes: Task 2 的 `api.songPlay / api.playReport`、`store.createStore`、`resolveUrl`
- Produces: `lrc.ts` → `parseLrc(text: string): LrcLine[]`（`LrcLine = {time: number, text: string}`，按 time 升序；无时间戳行忽略；多时间标签同行展开）
- Produces: `player.ts` → 单例 `player`：
  - `playQueue(songs: SongCardVO[] | PlaylistSongVO[] | CollectItemVO[] | RecentVO[], index: number, adapter?: (s:any)=>SongCardVO): void` — 整列表入队并从 index 播放；adapter 缺省时内置字段映射（`singerName→singer`、`songId→id`）
  - `toggle(): void`、`next(): void`、`prev(): void`、`seek(sec: number): void`、`setMode(): void`（order→single→random 循环切换）
  - 状态 store：`player.state` → `{cur: SongCardVO|null, playing: boolean, position: number, duration: number, mode: 'order'|'single'|random', lyrics: LrcLine[], lyricIndex: number}`；`player.subscribe(fn)` 透传
  - 内部职责：拉 `/song/play/{id}` → 拼 URL → `bgAudioManager.src/title/singer/coverUrl`；`onTimeUpdate` 节流 500ms 更新 position + 二分更新 lyricIndex；播满 30s 或过半上报一次（`reported` 标记，切歌补报）；`onEnded` 按 mode 自动下一曲（single 重播）
- 页面/组件只通过 `player.subscribe` + `player.xxx()` 交互，不直接碰 bgAudioManager

- [ ] **Step 1: 写 services/lrc.ts**

```ts
// services/lrc.ts
// LRC 歌词解析：[mm:ss.xx] 多时间标签展开 → [{time(秒), text}] 升序
export interface LrcLine {
  time: number
  text: string
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(text: string): LrcLine[] {
  if (!text) return []
  const out: LrcLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0
    const stamps: number[] = []
    let m: RegExpExecArray | null
    let lastEnd = 0
    while ((m = TIME_TAG.exec(raw)) !== null) {
      // 时间标签必须连续出现在行首（允许元数据标签 [xx:...] 混排时跳过非行首的）
      if (m.index !== lastEnd) break
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const fracRaw = m[3] || '0'
      const frac = parseInt(fracRaw, 10) / Math.pow(10, fracRaw.length)
      stamps.push(min * 60 + sec + frac)
      lastEnd = TIME_TAG.lastIndex
    }
    if (!stamps.length) continue
    const content = raw.slice(lastEnd).trim()
    for (const t of stamps) out.push({ time: t, text: content })
  }
  return out.sort((a, b) => a.time - b.time)
}

/** 二分找当前时间应显示的行（最后一个 time <= t 的行；t 早于首行返回 -1） */
export function findLrcIndex(lines: LrcLine[], t: number): number {
  if (!lines.length || t < lines[0].time) return -1
  let lo = 0
  let hi = lines.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (lines[mid].time <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}
```

- [ ] **Step 2: node 断言 lrc 纯函数**

```bash
cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc services/lrc.ts --outDir /tmp/mdcheck --module commonjs --target es2020 && node -e "
const {parseLrc, findLrcIndex} = require('/tmp/mdcheck/services/lrc.js');
const lrc = parseLrc('[00:01.5]你好\n[00:10]世界\n[00:10]双标\n[61.25]一分钟');
console.assert(lrc.length===4 && lrc[0].time===1.5 && lrc[0].text==='你好','parse basic');
console.assert(lrc[2].time===lrc[1].time && lrc[2].text==='双标','multi-tag same time');
console.assert(findLrcIndex(lrc,0)===-1 && findLrcIndex(lrc,1.6)===0 && findLrcIndex(lrc,60)===3,'bsearch');
console.assert(parseLrc('no tags here').length===0,'no tags');
console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: 写 services/player.ts**

```ts
// services/player.ts
// 全局播放器单例：BackgroundAudioManager + 队列/模式/上报/歌词，页面通过 subscribe 订阅状态
import { api, SongCardVO, PlaylistSongVO, CollectItemVO, RecentVO } from './api'
import { createStore } from './store'
import { resolveUrl } from '../config'
import { parseLrc, findLrcIndex, LrcLine } from './lrc'

export type PlayMode = 'order' | 'single' | 'random'

interface PlayerState {
  cur: SongCardVO | null
  playing: boolean
  position: number
  duration: number
  mode: PlayMode
  lyrics: LrcLine[]
  lyricIndex: number
}

/** 队列元素统一成 SongCardVO 形态（不同来源字段名不同） */
function normalize(s: any): SongCardVO {
  return {
    id: s.id != null ? s.id : s.songId,
    name: s.name || s.songName || '',
    singer: s.singer || s.singerName || '',
    singerId: s.singerId || 0,
    album: s.album || '',
    style: s.style || '',
    duration: s.duration || 0,
    coverUrl: s.coverUrl || '',
    playCount: s.playCount || 0,
    weekPlayCount: 0,
    score: 0
  }
}

const REPORT_AFTER_SEC = 30 // 播满 30 秒或过半上报一次

class Player {
  private store = createStore<PlayerState>({
    cur: null,
    playing: false,
    position: 0,
    duration: 0,
    mode: 'order',
    lyrics: [],
    lyricIndex: -1
  })
  private queue: SongCardVO[] = []
  private index = -1
  private audio = wx.getBackgroundAudioManager()
  private playSeq = 0 // 代际号：慢响应换歌时丢弃旧请求
  private reported = false
  private startAt = 0 // 当前曲开始播放时的 Date.now()
  private lastTick = 0 // onTimeUpdate 节流
  private volGain = 0

  constructor() {
    const a = this.audio
    a.onPlay(() => this.store.set({ playing: true }))
    a.onPause(() => this.store.set({ playing: false }))
    a.onStop(() => this.store.set({ playing: false }))
    a.onEnded(() => {
      this.flushReport()
      if (this.store.get().mode === 'single') this.replay()
      else this.next()
    })
    a.onNext(() => this.next()) // 系统播放器上一首/下一首
    a.onPrev(() => this.prev())
    a.onError((err: any) => {
      console.error('bgAudio error', err)
      this.store.set({ playing: false })
      wx.showToast({ title: '播放失败，已跳过', icon: 'none' })
      this.next()
    })
  }

  subscribe(fn: (s: PlayerState) => void): () => void {
    return this.store.subscribe(fn)
  }

  get state(): PlayerState {
    return this.store.get()
  }

  /** 整列表入队并播放 index（队列存统一形态） */
  playQueue(songs: any[], index: number): void {
    if (!songs || !songs.length) return
    this.queue = songs.map(normalize)
    this.playAt(index < 0 || index >= this.queue.length ? 0 : index)
  }

  /** 单曲插入播放：追加到队列尾部播放（简单可控） */
  playOne(song: any): void {
    const n = normalize(song)
    this.queue.push(n)
    this.playAt(this.queue.length - 1)
  }

  toggle(): void {
    if (!this.store.get().cur) {
      if (this.queue.length) this.playAt(0)
      return
    }
    if (this.store.get().playing) this.audio.pause()
    else this.audio.play()
  }

  next(): void {
    if (!this.queue.length) return
    const mode = this.store.get().mode
    let i: number
    if (mode === 'random') {
      i = this.queue.length === 1 ? this.index : Math.floor(Math.random() * this.queue.length)
    } else {
      i = (this.index + 1) % this.queue.length // order：到队尾回第一首（列表语义）
    }
    this.playAt(i)
  }

  prev(): void {
    if (!this.queue.length) return
    const mode = this.store.get().mode
    let i: number
    if (mode === 'random') {
      i = this.queue.length === 1 ? this.index : Math.floor(Math.random() * this.queue.length)
    } else {
      i = (this.index - 1 + this.queue.length) % this.queue.length
    }
    this.playAt(i)
  }

  seek(sec: number): void {
    this.audio.seek(sec)
    this.store.set({ position: sec })
  }

  setMode(): void {
    const order: PlayMode[] = ['order', 'single', 'random']
    const cur = this.store.get().mode
    const next = order[(order.indexOf(cur) + 1) % order.length]
    this.store.set({ mode: next })
  }

  /** 加入队列（不入播）；已存在不重复加 */
  enqueue(song: any): void {
    const n = normalize(song)
    if (!this.queue.some((s) => s.id === n.id)) this.queue.push(n)
  }

  // ---------- 内部 ----------

  private async playAt(i: number): Promise<void> {
    this.flushReport() // 上一首补报
    this.index = i
    const song = this.queue[i]
    const seq = ++this.playSeq
    this.store.set({
      cur: song,
      playing: false,
      position: 0,
      duration: song.duration || 0,
      lyrics: [],
      lyricIndex: -1
    })
    let vo: any
    try {
      vo = await api.songPlay(song.id)
    } catch (e) {
      return // toast 已由 api 层弹过
    }
    if (seq !== this.playSeq) return // 用户已切下一首，丢弃
    this.volGain = vo.volumeGain || 0
    this.reported = false
    this.startAt = Date.now()
    this.audio.title = song.name || vo.name || '未知歌曲'
    this.audio.singer = vo.singer || song.singer || ''
    this.audio.epname = vo.album || ''
    this.audio.coverUrl = resolveUrl(vo.coverUrl || song.coverUrl)
    this.audio.src = resolveUrl(vo.fileUrl) // 赋 src 即开播
    this.store.set({ playing: true, duration: vo.duration || song.duration || 0 })
    // 歌词：lyricUrl 存在则下载解析
    if (vo.lyricUrl) {
      wx.request({
        url: resolveUrl(vo.lyricUrl),
        method: 'GET',
        responseType: 'text',
        success: (res: any) => {
          if (seq !== this.playSeq) return
          const text = typeof res.data === 'string' ? res.data : ''
          this.store.set({ lyrics: parseLrc(text), lyricIndex: -1 })
        },
        fail: () => {}
      })
    }
  }

  private replay(): void {
    if (this.index >= 0) this.playAt(this.index)
  }

  /** 播满 30s 或过半上报一次；切歌时补报 */
  private flushReport(): void {
    const cur = this.store.get().cur
    if (!cur || this.reported) return
    const played = Math.floor((Date.now() - this.startAt) / 1000)
    const dur = this.store.get().duration || 0
    if (played >= REPORT_AFTER_SEC || (dur > 0 && played >= dur / 2)) {
      this.reported = true
      api.playReport(cur.id, played).catch(() => {})
    }
  }

  /** 播放页/迷你条每 500ms 调一次：更新进度与歌词行 */
  tick(): void {
    const now = Date.now()
    if (now - this.lastTick < 500) return
    this.lastTick = now
    const a = this.audio
    const position = a.currentTime || 0
    const duration = a.duration || this.store.get().duration
    const st = { position, duration }
    const lyrics = this.store.get().lyrics
    if (lyrics.length) {
      const lyricIndex = findLrcIndex(lyrics, position)
      if (lyricIndex !== this.store.get().lyricIndex) (st as any).lyricIndex = lyricIndex
    }
    this.store.set(st)
  }
}

export const player = new Player()
```

注意：`wx.getBackgroundAudioManager()` 在小程序冷启动（无 App 状态）即可调用；`title` 必须在 `src` 之前赋值（iOS 要求）。

- [ ] **Step 4: 类型检查 + player.report 判定断言**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出（0 错误）

上报判定是私有方法且依赖 Date.now()，抽不出纯函数就不硬测（设计允许）：代码走查 `flushReport` 分支（`reported` 未报且 (played>=30 或 played>=dur/2)）。

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 全局播放器（后台音频/队列/三模式/上报/歌词）与 LRC 解析"
```

---

### Task 4: 组件 song-item + mini-player

**Files:**
- Create: `components/song-item/song-item.ts|.wxml|.wxss|.json`
- Create: `components/mini-player/mini-player.ts|.wxml|.wxss|.json`

**Interfaces:**
- Consumes: Task 3 `player`（playQueue/toggle/next/subscribe/tick/state）、Task 2 `auth.requireLoginTip`、`api.collectIds/collectAdd/collectRemove`、Task 1 `fmtDuration/resolveUrl`
- Produces:
  - `song-item`：properties `{song: Object, index: Number, playing: Boolean, showCollect: Boolean(默认true), list: Array}`。**注意**：小程序组件 properties 传对象是引用拷贝，`list` 用于整列表入队。事件：`bindmore`（加入歌单按钮，`detail: {song}`）。内部点击行 → `player.playQueue(this.data.list, index)`；心形 → collectAdd/Remove（未登录 requireLoginTip）
  - `mini-player`：无 properties。attach 时订阅 player；`bindtap` 主体 → `wx.navigateTo /pages/playing/playing`；无 `cur` 时整条隐藏
- 页面使用：`usingComponents`: `{"song-item": "/components/song-item/song-item", "mini-player": "/components/mini-player/mini-player"}`

- [ ] **Step 1: 写 song-item 四件套**

`song-item.json`：

```json
{ "component": true, "usingComponents": {} }
```

`song-item.ts`：

```ts
// components/song-item/song-item.ts
// 歌曲行：点击=整列表入队播放；心形=收藏；…=加入歌单（页面处理）
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { api } from '../../services/api'
import { fmtDuration } from '../../utils/format'

Component({
  properties: {
    song: { type: Object, value: null },
    index: { type: Number, value: 0 },
    playing: { type: Boolean, value: false },
    showCollect: { type: Boolean, value: true },
    list: { type: Array, value: [] }
  },
  data: { durText: '', collected: false },
  observers: {
    song(s: any) {
      if (!s) return
      this.setData({ durText: fmtDuration(s.duration) })
      if (auth.isLoggedIn()) {
        api.collectIds().then((ids: number[]) => {
          this.setData({ collected: ids.indexOf(s.id) >= 0 })
        }).catch(() => {})
      }
    }
  },
  methods: {
    onTap() {
      player.playQueue(this.data.list, this.data.index)
    },
    onCollect() {
      if (!auth.requireLoginTip()) return
      const s = this.data.song
      if (this.data.collected) {
        api.collectRemove(s.id).then(() => {
          this.setData({ collected: false })
          wx.showToast({ title: '已取消收藏', icon: 'none' })
        }).catch(() => {})
      } else {
        api.collectAdd(s.id).then(() => {
          this.setData({ collected: true })
          wx.showToast({ title: '已收藏', icon: 'none' })
        }).catch(() => {})
      }
    },
    onMore() {
      this.triggerEvent('more', { song: this.data.song })
    }
  }
})
```

`song-item.wxml`：

```xml
<view class="si card {{playing ? 'si-on' : ''}}" bindtap="onTap">
  <image class="si-cover" src="{{song.coverUrl}}" mode="aspectFill" lazy-load="{{true}}" />
  <view class="si-main">
    <view class="si-name ellipsis">{{song.name}}</view>
    <view class="si-sub ellipsis">{{song.singer}}{{song.album ? ' · ' + song.album : ''}}</view>
  </view>
  <view wx:if="{{showCollect}}" class="si-act {{collected ? 'on' : ''}}" catchtap="onCollect">{{collected ? '♥' : '♡'}}</view>
  <view class="si-more" catchtap="onMore">…</view>
</view>
```

`song-item.wxss`：

```css
.si { display: flex; align-items: center; padding: 16rpx 20rpx; margin-bottom: 16rpx; }
.si-on { border: 1rpx solid var(--brand); }
.si-cover { width: 88rpx; height: 88rpx; border-radius: 12rpx; background: var(--line); flex-shrink: 0; }
.si-main { flex: 1; min-width: 0; margin: 0 20rpx; }
.si-name { font-size: 30rpx; font-weight: 600; }
.si-on .si-name { color: var(--brand); }
.si-sub { font-size: 24rpx; color: var(--text-sub); margin-top: 4rpx; }
.si-act, .si-more { padding: 12rpx 16rpx; color: var(--text-sub); font-size: 36rpx; }
.si-act.on { color: var(--brand); }
```

- [ ] **Step 2: 写 mini-player 四件套**

`mini-player.json`：

```json
{ "component": true, "usingComponents": {} }
```

`mini-player.ts`：

```ts
// components/mini-player/mini-player.ts
// 全局迷你播放条：订阅 player 状态；点主体进播放页；右下两个控制按钮
import { player } from '../../services/player'
import { resolveUrl } from '../../config'

Component({
  data: { cur: null as any, playing: false, cover: '' },
  lifetimes: {
    attached() {
      this._unsub = player.subscribe((s) => {
        this.setData({ cur: s.cur, playing: s.playing, cover: resolveUrl(s.cur && s.cur.coverUrl) })
      })
      this._timer = setInterval(() => player.tick(), 500)
    },
    detached() {
      this._unsub && this._unsub()
      this._timer && clearInterval(this._timer)
    }
  },
  methods: {
    openPlaying() {
      wx.navigateTo({ url: '/pages/playing/playing' })
    },
    onToggle() {
      player.toggle()
    },
    onNext(e: any) {
      // 阻止冒泡由 catchtap 保证
      player.next()
    }
  }
})
```

`mini-player.wxml`：

```xml
<view wx:if="{{cur}}" class="mp card" bindtap="openPlaying">
  <image class="mp-cover {{playing ? 'spin' : ''}}" src="{{cover}}" mode="aspectFill" />
  <view class="mp-main">
    <view class="mp-name ellipsis">{{cur.name}}</view>
    <view class="mp-singer ellipsis">{{cur.singer}}</view>
  </view>
  <view class="mp-btn" catchtap="onToggle">{{playing ? '⏸' : '▶'}}</view>
  <view class="mp-btn" catchtap="onNext">⏭</view>
</view>
```

`mini-player.wxss`：

```css
.mp {
  position: fixed;
  left: 20rpx;
  right: 20rpx;
  bottom: calc(env(safe-area-inset-bottom) + 110rpx); /* tab 页在 tabBar 上方；非 tab 页同样位置 */
  display: flex;
  align-items: center;
  padding: 14rpx 20rpx;
  z-index: 99;
}
.mp-cover { width: 72rpx; height: 72rpx; border-radius: 50%; background: var(--line); }
.mp-cover.spin { animation: mp-rotate 8s linear infinite; }
@keyframes mp-rotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.mp-main { flex: 1; min-width: 0; margin: 0 20rpx; }
.mp-name { font-size: 28rpx; font-weight: 600; }
.mp-singer { font-size: 22rpx; color: var(--text-sub); }
.mp-btn { padding: 10rpx 20rpx; font-size: 34rpx; color: var(--brand); }
```

- [ ] **Step 3: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出（0 错误）

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): song-item 与 mini-player 组件"
```

---

### Task 5: 登录页（登录/注册/找回三态）

**Files:**
- Modify: `pages/login/login.ts|.wxml|.wxss|.json`（替换占位）

**Interfaces:**
- Consumes: Task 2 `api.register/login/resetPassword`、`auth.save`；Task 4 mini-player（登录页不放 mini-player）
- Produces: 登录成功 → `auth.save(token, LoginVO)` → `wx.reLaunch('/pages/home/home')`（tab 页用 reLaunch 才能建立页面栈）
- Produces: 登录页 onShow 时若已登录直接 reLaunch 首页（token 过期跳过来的场景会先 clear，不会死循环）

- [ ] **Step 1: login.json / login.ts**

`login.json`：

```json
{ "navigationBarTitleText": "悦享音乐 · 登录", "usingComponents": {} }
```

```ts
// pages/login/login.ts
// 三态切换：login | register | reset（找回密码：用户名+邮箱+新密码）
import { api } from '../../services/api'
import { auth } from '../../services/auth'

Page({
  data: {
    mode: 'login' as 'login' | 'register' | 'reset',
    username: '',
    password: '',
    nickname: '',
    email: '',
    newPassword: '',
    loading: false
  },
  onShow() {
    if (auth.isLoggedIn()) wx.reLaunch({ url: '/pages/home/home' })
  },
  onField(e: any) {
    // 统一输入绑定：data-field 指定字段
    const field = e.currentTarget.dataset.field as string
    this.setData({ [field]: e.detail.value } as any)
  },
  switchMode(e: any) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },
  async submit() {
    if (this.data.loading) return
    const d = this.data
    if (d.mode === 'login') {
      if (!d.username || !d.password) return wx.showToast({ title: '请填写用户名和密码', icon: 'none' })
      await this.run(async () => {
        const vo = await api.login({ username: d.username, password: d.password, remember: true })
        auth.save(vo.token, vo)
        wx.reLaunch({ url: '/pages/home/home' })
      })
    } else if (d.mode === 'register') {
      if (!d.username || !d.nickname || !d.email || !d.password)
        return wx.showToast({ title: '请填写完整注册信息', icon: 'none' })
      await this.run(async () => {
        await api.register({ username: d.username, nickname: d.nickname, email: d.email, password: d.password })
        wx.showToast({ title: '注册成功，请查收激活邮件后登录', icon: 'none', duration: 3000 })
        this.setData({ mode: 'login' })
      })
    } else {
      if (!d.username || !d.email || !d.newPassword)
        return wx.showToast({ title: '请填写用户名、注册邮箱和新密码', icon: 'none' })
      await this.run(async () => {
        await api.resetPassword({ username: d.username, email: d.email, newPassword: d.newPassword })
        wx.showToast({ title: '密码已重置，请登录', icon: 'none' })
        this.setData({ mode: 'login', password: d.newPassword })
      })
    }
  },
  async run(fn: () => Promise<void>) {
    this.setData({ loading: true })
    try {
      await fn()
    } catch (e) {
      // api 层已 toast 过
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

- [ ] **Step 2: login.wxml / login.wxss**

```xml
<!-- pages/login/login.wxml -->
<view class="lg">
  <view class="lg-logo card">
    <view class="lg-title">悦享音乐</view>
    <view class="lg-sub">MusicDreamer</view>
  </view>

  <view class="lg-tabs">
    <view class="lg-tab {{mode === 'login' ? 'on' : ''}}" data-mode="login" bindtap="switchMode">登录</view>
    <view class="lg-tab {{mode === 'register' ? 'on' : ''}}" data-mode="register" bindtap="switchMode">注册</view>
    <view class="lg-tab {{mode === 'reset' ? 'on' : ''}}" data-mode="reset" bindtap="switchMode">找回密码</view>
  </view>

  <view class="lg-form card">
    <input class="lg-input" placeholder="用户名" value="{{username}}" data-field="username" bindinput="onField" />
    <input wx:if="{{mode === 'register'}}" class="lg-input" placeholder="昵称" value="{{nickname}}" data-field="nickname" bindinput="onField" />
    <input wx:if="{{mode === 'register' || mode === 'reset'}}" class="lg-input" placeholder="注册邮箱" value="{{email}}" data-field="email" bindinput="onField" />
    <input wx:if="{{mode !== 'reset'}}" class="lg-input" password placeholder="密码" value="{{password}}" data-field="password" bindinput="onField" />
    <input wx:if="{{mode === 'reset'}}" class="lg-input" password placeholder="新密码" value="{{newPassword}}" data-field="newPassword" bindinput="onField" />
    <button class="btn-brand lg-btn" loading="{{loading}}" bindtap="submit">
      {{mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码'}}
    </button>
  </view>
</view>
```

```css
/* pages/login/login.wxss */
.lg { padding: 100rpx 50rpx; }
.lg-logo { text-align: center; padding: 60rpx 0; margin-bottom: 50rpx; }
.lg-title { font-size: 52rpx; font-weight: 800; letter-spacing: 4rpx; }
.lg-sub { font-size: 24rpx; color: var(--text-sub); margin-top: 8rpx; }
.lg-tabs { display: flex; margin-bottom: 30rpx; }
.lg-tab { flex: 1; text-align: center; padding: 20rpx 0; color: var(--text-sub); border-bottom: 4rpx solid transparent; }
.lg-tab.on { color: var(--brand); border-bottom-color: var(--brand); font-weight: 700; }
.lg-form { padding: 40rpx 30rpx; }
.lg-input { border-bottom: 1rpx solid var(--line); padding: 24rpx 8rpx; margin-bottom: 10rpx; font-size: 30rpx; }
.lg-btn { margin-top: 50rpx; }
```

- [ ] **Step 3: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 登录页——登录/注册/找回密码三态"
```

---

### Task 6: 首页 home（推荐 + 双榜单）

**Files:**
- Modify: `pages/home/home.ts|.wxml|.wxss|.json`（替换占位）

**Interfaces:**
- Consumes: Task 2 `api.recommendList/songChart`、Task 3 `player`、Task 4 song-item/mini-player、`auth.isLoggedIn`
- Produces: 首页数据通道 `recommend/hot/rise` 三列表；song-item 的 `more` 事件 → action sheet「加入歌单」流程（**此流程在 Task 7 抽成页面通用工具** `utils/playlistPicker.ts`，首页先内联实现，Task 7 统一替换）

- [ ] **Step 1: home.json / home.ts**

`home.json`：

```json
{
  "navigationBarTitleText": "悦享音乐",
  "usingComponents": {
    "song-item": "/components/song-item/song-item",
    "mini-player": "/components/mini-player/mini-player"
  },
  "onReachBottomDistance": 100
}
```

```ts
// pages/home/home.ts
// 首页：推荐 + 热歌榜 + 飙升榜；匿名可看，收藏需登录
import { api, SongCardVO } from '../../services/api'
import { player } from '../../services/player'

interface Section {
  key: string
  title: string
  songs: SongCardVO[]
}

Page({
  data: { sections: [] as Section[], loading: true, curId: 0 },

  onLoad() {
    this._unsub = player.subscribe((s) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
  },
  onUnload() {
    this._unsub && this._unsub()
  },
  onShow() {
    this.load()
  },
  async load() {
    try {
      const [rec, hot, rise] = await Promise.all([
        api.recommendList(10),
        api.songChart('hot', 10),
        api.songChart('rise', 10)
      ])
      const sections: Section[] = [
        { key: 'rec', title: '为你推荐', songs: rec || [] },
        { key: 'hot', title: '热歌榜', songs: hot || [] },
        { key: 'rise', title: '飙升榜', songs: rise || [] }
      ]
      this.setData({ sections, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  onMore(e: any) {
    // 加入歌单：action sheet 选歌单
    const song = e.detail.song
    wx.showActionSheet({
      alertText: '加入歌单',
      itemList: ['加载中...'],
      success: () => {},
      fail: () => {}
    })
    this.pickPlaylist(song)
  },
  async pickPlaylist(song: SongCardVO) {
    // 简单实现：拉我的歌单 → action sheet；无歌单提示去音乐库创建
    try {
      const my = await api.myPlaylists()
      const created = (my && my.created) || []
      if (!created.length) {
        wx.showToast({ title: '还没有歌单，去「音乐库」创建', icon: 'none' })
        return
      }
      // itemList 最多 6 项，超出截断
      const names = created.slice(0, 6).map((p: any) => p.name)
      wx.showActionSheet({
        itemList: names,
        success: async (res) => {
          const pl = created[res.tapIndex]
          await api.addPlaylistSong(pl.id, song.id)
          wx.showToast({ title: '已加入「' + pl.name + '」', icon: 'none' })
        },
        fail: () => {}
      })
    } catch (e) {
      /* api 层已提示 */
    }
  }
})
```

- [ ] **Step 2: home.wxml / home.wxss**

```xml
<!-- pages/home/home.wxml -->
<view class="home">
  <view wx:if="{{loading}}" class="loading">加载中...</view>
  <view wx:for="{{sections}}" wx:key="key" wx:for-item="sec" class="sec">
    <view class="sec-title">{{sec.title}}</view>
    <song-item
      wx:for="{{sec.songs}}"
      wx:key="id"
      wx:for-item="song"
      song="{{song}}"
      index="{{index}}"
      playing="{{song.id === curId}}"
      list="{{sec.songs}}"
      bindmore="onMore"
    />
  </view>
  <mini-player />
</view>
```

```css
/* pages/home/home.wxss */
.home { padding: 20rpx 20rpx 200rpx; }
.loading { text-align: center; color: var(--text-sub); padding: 100rpx 0; }
.sec { margin-bottom: 40rpx; }
.sec-title { font-size: 34rpx; font-weight: 800; margin: 10rpx 8rpx 20rpx; }
```

- [ ] **Step 3: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 首页——推荐+热歌榜+飙升榜"
```

---

### Task 7: 广场页 square（搜索/曲风浏览 + 歌单广场 + 专辑广场）+ 通用加歌工具

**Files:**
- Create: `utils/playlistPicker.ts`
- Modify: `pages/square/square.ts|.wxml|.wxss|.json`（替换占位）
- Modify: `pages/home/home.ts`（把 Task 6 内联的 pickPlaylist 替换为 `pickPlaylist(song)` 工具函数调用）

**Interfaces:**
- Consumes: Task 2 `api.searchSongs/searchStyles/searchByStyle/publicPlaylists/publicAlbums`、`auth.requireLoginTip`；Task 4 组件
- Produces: `utils/playlistPicker.ts` → `pickPlaylist(song: {id: number, name?: string}): Promise<void>`（拉我的歌单→action sheet→加歌；无歌单提示去音乐库；≤6 项截断）。home/square/playlist 页共用
- Produces: square 页三段 tab：`songs | playlists | albums`；songs 段：搜索框 + 曲风横向滚动条 + song-item 列表 + 分页加载（onReachBottom）

- [ ] **Step 1: 写 utils/playlistPicker.ts，替换 home.ts 内联实现**

```ts
// utils/playlistPicker.ts
// 「加入歌单」通用流程：拉我的歌单 → action sheet 选择 → 加歌
import { api } from '../services/api'

export async function pickPlaylist(song: { id: number }): Promise<void> {
  const my = await api.myPlaylists()
  const created = (my && my.created) || []
  if (!created.length) {
    wx.showToast({ title: '还没有歌单，去「音乐库」创建', icon: 'none' })
    return
  }
  const names = created.slice(0, 6).map((p: any) => p.name) // action sheet 上限 6 项
  wx.showActionSheet({
    itemList: names,
    success: async (res) => {
      const pl = created[res.tapIndex]
      await api.addPlaylistSong(pl.id, song.id)
      wx.showToast({ title: '已加入「' + pl.name + '」', icon: 'none' })
    },
    fail: () => {}
  })
}
```

home.ts 修改：删掉 `onMore`/`pickPlaylist` 方法体，改为：

```ts
  onMore(e: any) {
    // 加入歌单（通用工具，登录校验内含）
    if (!requireAuth()) return
    pickPlaylist(e.detail.song)
  }
```

home.ts 顶部加 `import { pickPlaylist } from '../../utils/playlistPicker'` 与本地 `requireAuth`：

```ts
import { auth } from '../../services/auth'
const requireAuth = () => auth.requireLoginTip()
```

（注：`api.myPlaylists` 需登录——未登录时网关 401/2006 会被 api 层统一踢登录页；但体验上应先拦：所以 `onMore` 先 `requireAuth()`。）

- [ ] **Step 2: square.json / square.ts**

`square.json`：

```json
{
  "navigationBarTitleText": "悦享音乐 · 广场",
  "usingComponents": {
    "song-item": "/components/song-item/song-item",
    "mini-player": "/components/mini-player/mini-player"
  },
  "onReachBottomDistance": 100
}
```

```ts
// pages/square/square.ts
// 广场三段：歌曲（搜索+曲风）/ 歌单广场 / 专辑广场
import { api, SongCardVO, PlaylistVO } from '../../services/api'
import { player } from '../../services/player'
import { pickPlaylist } from '../../utils/playlistPicker'
import { auth } from '../../services/auth'

Page({
  data: {
    tab: 'songs' as 'songs' | 'playlists' | 'albums',
    keyword: '',
    styles: [] as string[],
    curStyle: '',
    songs: [] as SongCardVO[],
    songTotal: 0,
    page: 1,
    lists: [] as PlaylistVO[],
    listTotal: 0,
    loading: false,
    curId: 0
  },

  onLoad() {
    this._unsub = player.subscribe((s) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
    api.searchStyles().then((styles: string[]) => this.setData({ styles: styles || [] })).catch(() => {})
  },
  onUnload() {
    this._unsub && this._unsub()
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'songs') this.reloadSongs()
    else if (tab === 'playlists') this.loadLists('playlists', true)
    else this.loadLists('albums', true)
  },

  onKeyword(e: any) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch() {
    this.setData({ page: 1, songs: [], songTotal: 0 })
    this.loadSongs()
  },
  pickStyle(e: any) {
    const style = e.currentTarget.dataset.style
    this.setData({ curStyle: this.data.curStyle === style ? '' : style, page: 1, songs: [], songTotal: 0 })
    this.loadSongs()
  },

  async loadSongs() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const kw = this.data.keyword.trim()
      const res = kw
        ? await api.searchSongs(kw, this.data.page, 20)
        : await api.searchByStyle({ style: this.data.curStyle, page: this.data.page, size: 20 })
      const songs = this.data.songs.concat(res.songs || [])
      this.setData({ songs, songTotal: res.total || 0, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  reloadSongs() {
    this.setData({ page: 1, songs: [], songTotal: 0 })
    this.loadSongs()
  },
  onReachBottom() {
    if (this.data.tab !== 'songs' || this.data.loading) return
    if (this.data.songs.length >= this.data.songTotal) return
    this.setData({ page: this.data.page + 1 })
    this.loadSongs()
  },

  async loadLists(kind: 'playlists' | 'albums', reset: boolean) {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const fn = kind === 'playlists' ? api.publicPlaylists : api.publicAlbums
      const res = await fn({ page: 1, size: 20, keyword: this.data.keyword.trim() })
      const key = kind === 'playlists' ? 'lists' : 'lists' // 两段共用 lists
      this.setData({ [key]: res.records || [], listTotal: res.total || 0, loading: false } as any)
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onPlayMore(e: any) {
    if (!auth.requireLoginTip()) return
    pickPlaylist(e.detail.song)
  },
  onListTap(e: any) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/playlist/playlist?id=${id}&type=${type}` })
  }
})
```

- [ ] **Step 3: square.wxml / square.wxss**

```xml
<!-- pages/square/square.wxml -->
<view class="sq">
  <view class="sq-tabs">
    <view class="sq-tab {{tab === 'songs' ? 'on' : ''}}" data-tab="songs" bindtap="switchTab">歌曲</view>
    <view class="sq-tab {{tab === 'playlists' ? 'on' : ''}}" data-tab="playlists" bindtap="switchTab">歌单</view>
    <view class="sq-tab {{tab === 'albums' ? 'on' : ''}}" data-tab="albums" bindtap="switchTab">专辑</view>
  </view>

  <view wx:if="{{tab === 'songs'}}" class="sq-songs">
    <view class="sq-search card">
      <input class="sq-search-input" placeholder="搜歌名 / 歌手 / 专辑" value="{{keyword}}" bindinput="onKeyword"
        bindconfirm="onSearch" confirm-type="search" />
      <view class="sq-search-btn" bindtap="onSearch">搜索</view>
    </view>
    <scroll-view scroll-x class="sq-styles" wx:if="{{styles.length}}">
      <view class="sq-style {{curStyle === s ? 'on' : ''}}" wx:for="{{styles}}" wx:key="*this"
        wx:for-item="s" data-style="{{s}}" bindtap="pickStyle">{{s}}</view>
    </scroll-view>
    <song-item wx:for="{{songs}}" wx:key="id" song="{{item}}" index="{{index}}" playing="{{item.id === curId}}"
      list="{{songs}}" bindmore="onPlayMore" />
    <view wx:if="{{!songs.length && !loading}}" class="sq-empty">换个关键词试试</view>
  </view>

  <view wx:if="{{tab === 'playlists'}}" class="sq-lists">
    <view class="pl-card card" wx:for="{{lists}}" wx:key="id" data-id="{{item.id}}" data-type="playlist" bindtap="onListTap">
      <image class="pl-cover" src="{{item.coverUrl}}" mode="aspectFill" lazy-load="{{true}}" />
      <view class="pl-main">
        <view class="pl-name ellipsis">{{item.name}}</view>
        <view class="pl-sub ellipsis">{{item.songCount}}首 · by {{item.creatorName || '佚名'}}</view>
      </view>
    </view>
    <view wx:if="{{!lists.length && !loading}}" class="sq-empty">暂无公开歌单</view>
  </view>

  <view wx:if="{{tab === 'albums'}}" class="sq-lists">
    <view class="pl-card card" wx:for="{{lists}}" wx:key="id" data-id="{{item.id}}" data-type="album" bindtap="onListTap">
      <image class="pl-cover" src="{{item.coverUrl}}" mode="aspectFill" lazy-load="{{true}}" />
      <view class="pl-main">
        <view class="pl-name ellipsis">{{item.name}}</view>
        <view class="pl-sub ellipsis">{{item.songCount}}首 · {{item.singerName || item.creatorName || '佚名'}}</view>
      </view>
    </view>
    <view wx:if="{{!lists.length && !loading}}" class="sq-empty">暂无公开专辑</view>
  </view>

  <mini-player />
</view>
```

```css
/* pages/square/square.wxss */
.sq { padding: 20rpx 20rpx 200rpx; }
.sq-tabs { display: flex; margin-bottom: 24rpx; }
.sq-tab { flex: 1; text-align: center; padding: 18rpx 0; font-size: 30rpx; color: var(--text-sub); border-bottom: 4rpx solid transparent; }
.sq-tab.on { color: var(--brand); border-color: var(--brand); font-weight: 700; }
.sq-search { display: flex; align-items: center; padding: 8rpx 20rpx; margin-bottom: 20rpx; }
.sq-search-input { flex: 1; padding: 16rpx 0; }
.sq-search-btn { color: var(--brand); font-weight: 700; padding: 10rpx 16rpx; }
.sq-styles { white-space: nowrap; margin-bottom: 20rpx; }
.sq-style { display: inline-block; padding: 10rpx 28rpx; margin-right: 16rpx; background: var(--card); border-radius: 999rpx; color: var(--text-sub); font-size: 26rpx; }
.sq-style.on { background: var(--brand); color: #fff; }
.sq-empty { text-align: center; color: var(--text-sub); padding: 100rpx 0; }
.pl-card { display: flex; align-items: center; padding: 16rpx 20rpx; margin-bottom: 16rpx; }
.pl-cover { width: 96rpx; height: 96rpx; border-radius: 12rpx; background: var(--line); flex-shrink: 0; }
.pl-main { flex: 1; min-width: 0; margin-left: 20rpx; }
.pl-name { font-size: 30rpx; font-weight: 600; }
.pl-sub { font-size: 24rpx; color: var(--text-sub); margin-top: 4rpx; }
```

- [ ] **Step 4: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 广场页——搜索/曲风/歌单广场/专辑广场 + 通用加歌工具"
```

---

### Task 8: 歌单/专辑详情页 playlist（共用模板）

**Files:**
- Modify: `pages/playlist/playlist.ts|.wxml|.wxss|.json`（替换占位）

**Interfaces:**
- Consumes: Task 2 `api.playlistDetail/albumDetail/favPlaylist/unfavPlaylist/addPlaylistSong/removePlaylistSong/deletePlaylist/createPlaylist/searchSongs`、`auth`；Task 3 `player.playQueue`；Task 4 song-item/mini-player；Task 7 `pickPlaylist`
- Produces: 页面参数 `?id=<number>&type=playlist|album`（缺省 playlist）。主人判定：登录态 `auth.get().user.id === detail.userId`。歌曲行统一转成 `PlaylistSongVO → normalize`（song-item 内部处理 songId→id 映射，这里直接传 `list`）
- Produces: 半屏「加歌」弹层：搜索歌名 → 点结果 `addPlaylistSong` → 局部刷新

- [ ] **Step 1: playlist.json / playlist.ts**

`playlist.json`：

```json
{
  "navigationBarTitleText": "悦享音乐 · 歌单",
  "usingComponents": {
    "song-item": "/components/song-item/song-item",
    "mini-player": "/components/mini-player/mini-player"
  }
}
```

```ts
// pages/playlist/playlist.ts
// 歌单/专辑共用详情：头部信息+播放全部+收藏+主人管理（加歌/删歌/删除）
import { api } from '../../services/api'
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { pickPlaylist } from '../../utils/playlistPicker'
import { fmtDuration } from '../../utils/format'

Page({
  data: {
    type: 'playlist' as 'playlist' | 'album',
    id: 0,
    detail: null as any,
    isOwner: false,
    songs: [] as any[], // 已映射为 song-item 可用形态 {id,name,singer,duration,coverUrl,album}
    playing: false,
    curId: 0,
    // 加歌弹层
    addShow: false,
    addKw: '',
    addResults: [] as any[],
    adding: false
  },

  onLoad(options: any) {
    this.setData({ id: Number(options.id) || 0, type: options.type === 'album' ? 'album' : 'playlist' })
    this._unsub = player.subscribe((s) => {
      this.setData({ playing: s.playing, curId: (s.cur && s.cur.id) || 0 })
    })
  },
  onUnload() {
    this._unsub && this._unsub()
  },
  onShow() {
    this.load()
  },

  async load() {
    try {
      const d =
        this.data.type === 'album' ? await api.albumDetail(this.data.id) : await api.playlistDetail(this.data.id)
      const me = auth.get()
      const isOwner = !!(me && d && me.user.id === d.userId)
      const songs = ((d && d.songs) || []).map((s: any) => ({
        id: s.songId,
        name: s.name,
        singer: s.singerName,
        album: s.album,
        style: s.style,
        duration: s.duration,
        coverUrl: s.coverUrl
      }))
      this.setData({ detail: d, isOwner, songs })
      if (d && d.name) wx.setNavigationBarTitle({ title: '悦享音乐 · ' + d.name })
    } catch (e) {
      // api 层已提示（私有歌单无权限等）
    }
  },

  playAll() {
    if (!this.data.songs.length) return wx.showToast({ title: '歌单还没有歌曲', icon: 'none' })
    player.playQueue(this.data.songs, 0)
  },

  async toggleFav() {
    if (!auth.requireLoginTip() || !this.data.detail) return
    const d = this.data.detail
    if (d.favored) {
      await (this.data.type === 'album' ? Promise.resolve() : api.unfavPlaylist(d.id))
      // 专辑收藏接口一期未纳入（广场仅浏览），这里按类型分派：
      wx.showToast({ title: '已取消收藏', icon: 'none' })
      this.setData({ 'detail.favored': false })
    } else {
      await api.favPlaylist(d.id)
      wx.showToast({ title: '已收藏歌单', icon: 'none' })
      this.setData({ 'detail.favored': true })
    }
  },

  onSongMore(e: any) {
    if (!auth.requireLoginTip()) return
    pickPlaylist(e.detail.song)
  },

  async removeSong(e: any) {
    if (!this.data.isOwner) return
    const songId = e.currentTarget.dataset.id
    const fn =
      this.data.type === 'album' ? () => api.albumRemoveSong(this.data.id, songId) : () => api.removePlaylistSong(this.data.id, songId)
    const that = this
    wx.showModal({
      title: '从' + (this.data.type === 'album' ? '专辑' : '歌单') + '移除',
      content: '确定移除这首歌曲吗？',
      success: async (res) => {
        if (!res.confirm) return
        await fn()
        wx.showToast({ title: '已移除', icon: 'none' })
        that.load()
      }
    })
  },

  async removeList() {
    if (!this.data.isOwner) return
    const that = this
    wx.showModal({
      title: '删除确认',
      content: '删除后不可恢复，确定删除整个' + (this.data.type === 'album' ? '专辑' : '歌单') + '吗？',
      success: async (res) => {
        if (!res.confirm) return
        await api.deletePlaylist(that.data.id)
        wx.showToast({ title: '已删除', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  },

  // ---------- 半屏加歌弹层 ----------
  openAdd() {
    if (!auth.requireLoginTip()) return
    this.setData({ addShow: true, addKw: '', addResults: [] })
  },
  closeAdd() {
    this.setData({ addShow: false })
  },
  onAddKw(e: any) {
    this.setData({ addKw: e.detail.value })
  },
  async doAddSearch() {
    const kw = this.data.addKw.trim()
    if (!kw) return
    const res = await api.searchSongs(kw, 1, 20)
    this.setData({ addResults: res.songs || [] })
  },
  async addSong(e: any) {
    if (this.data.adding) return
    const song = e.currentTarget.dataset.song
    this.setData({ adding: true })
    try {
      await api.addPlaylistSong(this.data.id, song.id)
      wx.showToast({ title: '已添加', icon: 'none' })
      this.setData({ adding: false })
      this.load()
    } catch (e) {
      this.setData({ adding: false })
    }
  }
})
```

**勘误（ album 收藏）**：专辑收藏/取消收藏接口与歌单完全同构（`POST/DELETE /album/{id}/favorite`，已在后端核实）。上面 `toggleFav` 的专辑分支应为 `api.albumFav / api.albumUnfav`——因此 **Task 2 的 api.ts 需补充两个接口**（在 Task 8 执行时一并加入 `services/api.ts` 的 album 区块）：

```ts
  // 追加到 api 对象（album 区块）
  albumFav: (id: number) => post(`/album/${id}/favorite`),
  albumUnfav: (id: number) => del(`/album/${id}/favorite`),
```

并把 `toggleFav` 改为：

```ts
  async toggleFav() {
    if (!auth.requireLoginTip() || !this.data.detail) return
    const d = this.data.detail
    const isAlbum = this.data.type === 'album'
    if (d.favored) {
      await (isAlbum ? api.albumUnfav(d.id) : api.unfavPlaylist(d.id))
      wx.showToast({ title: '已取消收藏', icon: 'none' })
      this.setData({ 'detail.favored': false })
    } else {
      await (isAlbum ? api.albumFav(d.id) : api.favPlaylist(d.id))
      wx.showToast({ title: isAlbum ? '已收藏专辑' : '已收藏歌单', icon: 'none' })
      this.setData({ 'detail.favored': true })
    }
  }
```

同理专辑加歌/删歌是 `POST/DELETE /album/{id}/song/{songId}`，api.ts 补：

```ts
  albumAddSong: (id: number, songId: number) => post(`/album/${id}/song/${songId}`),
  albumRemoveSong: (id: number, songId: number) => del(`/album/${id}/song/${songId}`),
```

`addSong` 与 `removeSong` 中的 playlist 接口调用按 `isAlbum` 分派（与 toggleFav 同形）。

- [ ] **Step 2: playlist.wxml / playlist.wxss**

```xml
<!-- pages/playlist/playlist.wxml -->
<view class="pd" wx:if="{{detail}}">
  <view class="pd-head card">
    <image class="pd-cover" src="{{detail.coverUrl}}" mode="aspectFill" />
    <view class="pd-info">
      <view class="pd-name">{{detail.name}}</view>
      <view class="pd-sub">{{detail.isPublic ? '公开' : '私有'}} · {{songs.length}}首</view>
      <view class="pd-desc ellipsis2">{{detail.description || (type === 'album' ? '专辑' : '歌单')}}</view>
    </view>
  </view>

  <view class="pd-actions">
    <button class="btn-brand pd-play" bindtap="playAll">▶ 播放全部</button>
    <button class="pd-fav {{detail.favored ? 'on' : ''}}" bindtap="toggleFav">{{detail.favored ? '♥ 已收藏' : '♡ 收藏'}}</button>
    <button wx:if="{{isOwner}}" class="pd-fav" bindtap="openAdd">＋ 加歌</button>
    <button wx:if="{{isOwner}}" class="pd-del" bindtap="removeList">删除</button>
  </view>

  <view class="pd-songs">
    <block wx:for="{{songs}}" wx:key="id">
      <view class="pd-songrow">
        <song-item song="{{item}}" index="{{index}}" playing="{{item.id === curId}}" list="{{songs}}" bindmore="onSongMore" />
        <view wx:if="{{isOwner}}" class="pd-rm" data-id="{{item.id}}" catchtap="removeSong">移除</view>
      </view>
    </block>
    <view wx:if="{{!songs.length}}" class="pd-empty">还没有歌曲</view>
  </view>

  <!-- 半屏加歌弹层 -->
  <view wx:if="{{addShow}}" class="pd-mask" bindtap="closeAdd">
    <view class="pd-add card" catchtap="">
      <view class="pd-add-title">添加歌曲到{{type === 'album' ? '专辑' : '歌单'}}</view>
      <view class="pd-add-search">
        <input class="pd-add-input" placeholder="搜索歌名" value="{{addKw}}" bindinput="onAddKw"
          bindconfirm="doAddSearch" confirm-type="search" />
        <view class="pd-add-btn" bindtap="doAddSearch">搜索</view>
      </view>
      <scroll-view scroll-y class="pd-add-list">
        <view class="pd-add-item hairline" wx:for="{{addResults}}" wx:key="id" data-song="{{item}}" bindtap="addSong">
          <view class="ellipsis">{{item.name}} - {{item.singer}}</view>
        </view>
        <view wx:if="{{!addResults.length}}" class="pd-empty">输入关键词搜索歌曲</view>
      </scroll-view>
    </view>
  </view>

  <mini-player />
</view>
```

```css
/* pages/playlist/playlist.wxss */
.pd { padding: 20rpx 20rpx 200rpx; }
.pd-head { display: flex; padding: 30rpx; margin-bottom: 24rpx; }
.pd-cover { width: 180rpx; height: 180rpx; border-radius: 16rpx; background: var(--line); flex-shrink: 0; }
.pd-info { flex: 1; min-width: 0; margin-left: 24rpx; }
.pd-name { font-size: 36rpx; font-weight: 800; }
.pd-sub { font-size: 24rpx; color: var(--text-sub); margin: 10rpx 0; }
.pd-desc { font-size: 24rpx; color: var(--text-sub); }
.ellipsis2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.pd-actions { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.pd-play { flex: 2; }
.pd-fav { flex: 1; background: var(--card); color: var(--text); border-radius: 16rpx; font-size: 26rpx; }
.pd-fav.on { color: var(--brand); }
.pd-del { flex: 1; background: transparent; color: #d0453c; border-radius: 16rpx; font-size: 26rpx; }
.pd-songrow { position: relative; }
.pd-rm { position: absolute; right: 20rpx; bottom: 30rpx; font-size: 24rpx; color: #d0453c; padding: 8rpx 12rpx; }
.pd-empty { text-align: center; color: var(--text-sub); padding: 80rpx 0; }
.pd-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 100; display: flex; align-items: flex-end; }
.pd-add { width: 100%; border-radius: 24rpx 24rpx 0 0; padding: 30rpx; box-sizing: border-box; }
.pd-add-title { font-size: 32rpx; font-weight: 700; margin-bottom: 20rpx; }
.pd-add-search { display: flex; align-items: center; border-bottom: 1rpx solid var(--line); }
.pd-add-input { flex: 1; padding: 18rpx 0; }
.pd-add-btn { color: var(--brand); font-weight: 700; padding: 10rpx 16rpx; }
.pd-add-list { height: 50vh; margin-top: 10rpx; }
.pd-add-item { padding: 24rpx 8rpx; }
```

- [ ] **Step 3: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 歌单/专辑详情页——播放全部/收藏/主人管理与半屏加歌"
```

---

### Task 9: 播放页 playing（大封面/进度/歌词/控制）

**Files:**
- Modify: `pages/playing/playing.ts|.wxml|.wxss|.json`（替换占位）

**Interfaces:**
- Consumes: Task 3 `player` 全部能力；Task 2 `api.collectIds/collectAdd/collectRemove`、`auth.requireLoginTip`
- Produces: 播放页每 500ms（`setInterval`）调 `player.tick()` 驱动 UI；slider `bindchange` → `player.seek(v)`（拖动中 `bindchanging` 只更新本地显示，不 seek）；歌词区用 `scroll-view`，`scroll-into-view="lyric-{lyricIndex}"` 自动滚动

- [ ] **Step 1: playing.json / playing.ts**

`playing.json`：

```json
{ "navigationBarTitleText": "悦享音乐 · 播放", "usingComponents": {} }
```

```ts
// pages/playing/playing.ts
// 播放页：进度拖拽 / 三模式 / 上下曲 / 歌词滚动 / 收藏
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { api } from '../../services/api'
import { resolveUrl } from '../../config'
import { fmtDuration } from '../../utils/format'

const MODE_TEXT: Record<string, string> = { order: '顺序播放', single: '单曲循环', random: '随机播放' }

Page({
  data: {
    cur: null as any,
    playing: false,
    position: 0,
    duration: 0,
    posText: '0:00',
    durText: '--:--',
    mode: 'order',
    modeText: MODE_TEXT.order,
    lyrics: [] as any[],
    lyricIndex: -1,
    dragging: false,
    dragValue: 0,
    collected: false,
    cover: '',
    tab: 'cover' as 'cover' | 'lyric'
  },

  onLoad() {
    this._unsub = player.subscribe((s) => this.render(s))
    this.render(player.state)
    this._timer = setInterval(() => player.tick(), 500)
  },
  onUnload() {
    this._unsub && this._unsub()
    clearInterval(this._timer)
  },

  render(s: any) {
    const patch: IAnyObject = {
      cur: s.cur,
      playing: s.playing,
      position: s.position,
      duration: s.duration,
      posText: fmtDuration(s.position),
      durText: fmtDuration(s.duration),
      mode: s.mode,
      modeText: MODE_TEXT[s.mode],
      lyrics: s.lyrics,
      lyricIndex: s.lyricIndex,
      cover: resolveUrl(s.cur && s.cur.coverUrl)
    }
    // 换歌时刷新收藏态
    if (s.cur && s.cur.id !== this._lastId) {
      this._lastId = s.cur.id
      this.refreshCollect(s.cur.id)
    }
    if (!this.data.dragging) patch.position = s.position
    this.setData(patch)
  },

  async refreshCollect(songId: number) {
    if (!auth.isLoggedIn()) {
      this.setData({ collected: false })
      return
    }
    try {
      const ids = await api.collectIds()
      this.setData({ collected: ids.indexOf(songId) >= 0 })
    } catch (e) {}
  },

  onToggle() {
    player.toggle()
  },
  onNext() {
    player.next()
  },
  onPrev() {
    player.prev()
  },
  onMode() {
    player.setMode()
  },

  onDragStart() {
    this.setData({ dragging: true })
  },
  onDragging(e: any) {
    this.setData({ dragValue: e.detail.value, posText: fmtDuration(e.detail.value) })
  },
  onDragEnd(e: any) {
    player.seek(e.detail.value)
    this.setData({ dragging: false })
  },

  onCollect() {
    if (!auth.requireLoginTip() || !this.data.cur) return
    const id = this.data.cur.id
    if (this.data.collected) {
      api.collectRemove(id).then(() => {
        this.setData({ collected: false })
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      }).catch(() => {})
    } else {
      api.collectAdd(id).then(() => {
        this.setData({ collected: true })
        wx.showToast({ title: '已收藏', icon: 'none' })
      }).catch(() => {})
    }
  },

  switchTab(e: any) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  }
})
```

- [ ] **Step 2: playing.wxml / playing.wxss**

```xml
<!-- pages/playing/playing.wxml -->
<view class="py" wx:if="{{cur}}">
  <view class="py-tabs">
    <view class="py-tab {{tab === 'cover' ? 'on' : ''}}" data-tab="cover" bindtap="switchTab">封面</view>
    <view class="py-tab {{tab === 'lyric' ? 'on' : ''}}" data-tab="lyric" bindtap="switchTab">歌词</view>
  </view>

  <view wx:if="{{tab === 'cover'}}" class="py-cover-wrap">
    <image class="py-cover {{playing ? 'spin' : ''}}" src="{{cover}}" mode="aspectFill" />
  </view>
  <scroll-view wx:else scroll-y class="py-lyrics" scroll-into-view="lyric-{{lyricIndex}}" scroll-with-animation>
    <view wx:if="{{!lyrics.length}}" class="py-empty">暂无歌词</view>
    <view wx:for="{{lyrics}}" wx:key="index" id="lyric-{{index}}"
      class="py-line {{index === lyricIndex ? 'on' : ''}}">{{item.text}}</view>
    <view class="py-pad"></view>
  </scroll-view>

  <view class="py-name">{{cur.name}}</view>
  <view class="py-singer">{{cur.singer}}</view>

  <view class="py-progress">
    <text class="py-time">{{posText}}</text>
    <slider class="py-slider" min="0" max="{{duration || 1}}" value="{{position}}" activeColor="#ff6b1a"
      block-size="16" bindchange="onDragEnd" bindchanging="onDragging" bindchangestart?="" />
    <text class="py-time">{{durText}}</text>
  </view>

  <view class="py-controls">
    <view class="py-ctl" bindtap="onMode">{{mode === 'order' ? '🔁' : mode === 'single' ? '🔂' : '🔀'}}</view>
    <view class="py-ctl" bindtap="onCollect">{{collected ? '♥' : '♡'}}</view>
    <view class="py-ctl py-main" bindtap="onPrev">⏮</view>
    <view class="py-ctl py-play" bindtap="onToggle">{{playing ? '⏸' : '▶'}}</view>
    <view class="py-ctl py-main" bindtap="onNext">⏭</view>
  </view>
</view>
<view wx:else class="py-none">还没有播放歌曲，去首页点一首吧</view>
```

**勘误（slider 事件）**：上面 wxml 里 `bindchangestart?=""` 是笔误，slider 无此属性；拖动开始用 `bindtouchstart` 不可靠，**改为在 `bindchanging` 第一次触发时置 dragging=true**。最终 wxml 进度条行：

```xml
    <slider class="py-slider" min="0" max="{{duration || 1}}" value="{{position}}" activeColor="#ff6b1a"
      block-size="16" bindchange="onDragEnd" bindchanging="onDragging" />
```

对应 playing.ts 里 `onDragging` 改为：

```ts
  onDragging(e: any) {
    if (!this.data.dragging) this.setData({ dragging: true })
    this.setData({ dragValue: e.detail.value, posText: fmtDuration(e.detail.value) })
  },
```

且 `render` 中已有 `if (!this.data.dragging) patch.position = s.position`——拖动中不受 tick 覆盖。

```css
/* pages/playing/playing.wxss */
.py { display: flex; flex-direction: column; height: 100vh; padding: 20rpx 40rpx calc(env(safe-area-inset-bottom) + 40rpx); box-sizing: border-box; }
.py-tabs { display: flex; justify-content: center; gap: 40rpx; margin-bottom: 20rpx; }
.py-tab { color: var(--text-sub); padding: 8rpx 20rpx; border-bottom: 4rpx solid transparent; }
.py-tab.on { color: var(--brand); border-color: var(--brand); font-weight: 700; }
.py-cover-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.py-cover { width: 70vw; height: 70vw; max-width: 560rpx; max-height: 560rpx; border-radius: 32rpx; box-shadow: 0 20rpx 60rpx rgba(93, 76, 60, 0.25); }
.py-cover.spin { animation: py-rotate 20s linear infinite; }
@keyframes py-rotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.py-lyrics { flex: 1; min-height: 0; }
.py-line { text-align: center; padding: 16rpx 0; color: var(--text-sub); font-size: 28rpx; transition: all 0.3s; }
.py-line.on { color: var(--brand); font-size: 34rpx; font-weight: 700; }
.py-pad { height: 40vh; }
.py-empty { text-align: center; color: var(--text-sub); padding-top: 30vh; }
.py-name { font-size: 40rpx; font-weight: 800; text-align: center; margin-top: 20rpx; }
.py-singer { font-size: 26rpx; color: var(--text-sub); text-align: center; margin: 10rpx 0 30rpx; }
.py-progress { display: flex; align-items: center; margin-bottom: 20rpx; }
.py-time { font-size: 22rpx; color: var(--text-sub); width: 80rpx; text-align: center; }
.py-slider { flex: 1; margin: 0 8rpx; }
.py-controls { display: flex; align-items: center; justify-content: center; gap: 50rpx; }
.py-ctl { font-size: 52rpx; color: var(--text); }
.py-main { font-size: 64rpx; }
.py-play { font-size: 88rpx; color: var(--brand); }
.py-none { text-align: center; padding-top: 40vh; color: var(--text-sub); }
```

- [ ] **Step 3: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 播放页——大封面/歌词滚动/进度拖拽/三模式控制"
```

---

### Task 10: 音乐库 library + 我的 mine

**Files:**
- Modify: `pages/library/library.ts|.wxml|.wxss|.json`、`pages/mine/mine.ts|.wxml|.wxss|.json`（替换占位）

**Interfaces:**
- Consumes: Task 2 `api.collectList/myPlaylists/createPlaylist/deletePlaylist/recentPlays/userInfo/logout`、`auth`；Task 4 组件；Task 7 `pickPlaylist`
- Produces: library 三段 tab：`songs(收藏) | playlists(我的歌单: created+favorited) | recent(最近播放)`；mine 页：用户卡（头像/昵称/角色文字）+ 最近播放入口（放 library 的 recent 段）+ 退出登录
- Produces: 未登录访问 library：三个段都显示「登录后查看」引导按钮 → 登录页

- [ ] **Step 1: library.json / library.ts**

`library.json`：

```json
{
  "navigationBarTitleText": "悦享音乐 · 音乐库",
  "usingComponents": {
    "song-item": "/components/song-item/song-item",
    "mini-player": "/components/mini-player/mini-player"
  }
}
```

```ts
// pages/library/library.ts
// 音乐库三段：收藏歌曲 / 我的歌单(创建+收藏) / 最近播放
import { api, SongCardVO, PlaylistVO, RecentVO } from '../../services/api'
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { fmtDuration } from '../../utils/format'

Page({
  data: {
    tab: 'songs' as 'songs' | 'playlists' | 'recent',
    loggedIn: false,
    collects: [] as any[],
    created: [] as PlaylistVO[],
    favorited: [] as PlaylistVO[],
    recents: [] as any[],
    curId: 0
  },

  onLoad() {
    this._unsub = player.subscribe((s) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
  },
  onUnload() {
    this._unsub && this._unsub()
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) return
    if (this.data.tab === 'songs') this.loadCollects()
    else if (this.data.tab === 'recent') this.loadRecents()
    else this.loadPlaylists()
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    if (!auth.isLoggedIn()) return auth.requireLoginTip()
    if (tab === 'songs') this.loadCollects()
    else if (tab === 'recent') this.loadRecents()
    else this.loadPlaylists()
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async loadCollects() {
    try {
      const res = await api.collectList(1, 100)
      const collects = ((res && res.records) || []).map((c: any) => ({
        id: c.songId,
        name: c.name,
        singer: c.singerName,
        album: c.album,
        style: c.style,
        duration: c.duration,
        coverUrl: c.coverUrl
      }))
      this.setData({ collects })
    } catch (e) {}
  },

  async loadPlaylists() {
    try {
      const my = await api.myPlaylists()
      this.setData({ created: (my && my.created) || [], favorited: (my && my.favorited) || [] })
    } catch (e) {}
  },

  async loadRecents() {
    try {
      const recents = await api.recentPlays(20)
      this.setData({ recents: (recents || []).map((r: RecentVO) => ({ ...r, durText: fmtDuration(r.duration) })) })
    } catch (e) {}
  },

  playRecent(e: any) {
    const index = e.currentTarget.dataset.index
    player.playQueue(this.data.recents, index)
  },

  onCreatePlaylist() {
    if (!auth.requireLoginTip()) return
    const that = this
    wx.showModal({
      title: '新建歌单',
      editable: true,
      placeholderText: '歌单名称',
      success: async (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return
        await api.createPlaylist({ name: res.content.trim(), isPublic: true })
        wx.showToast({ title: '已创建', icon: 'none' })
        that.loadPlaylists()
      }
    })
  },

  onPlaylistTap(e: any) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/playlist/playlist?id=${id}&type=${type}` })
  },

  async deletePlaylist(e: any) {
    const id = e.currentTarget.dataset.id
    const that = this
    wx.showModal({
      title: '删除歌单',
      content: '确定删除这个歌单吗？',
      success: async (res) => {
        if (!res.confirm) return
        await api.deletePlaylist(id)
        wx.showToast({ title: '已删除', icon: 'none' })
        that.loadPlaylists()
      }
    })
  },

  onSongMore(e: any) {
    if (!auth.requireLoginTip()) return
    pickPlaylistCompat(e.detail.song)
  }
})

// 页面外不能引用未导入符号——放到顶部 import：见文件头
import { pickPlaylist as pickPlaylistCompat } from '../../utils/playlistPicker'
```

**勘误（import 位置）**：ES import 必须在文件顶部。最终 library.ts 文件头 import 区：

```ts
import { api, SongCardVO, PlaylistVO, RecentVO } from '../../services/api'
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { fmtDuration } from '../../utils/format'
import { pickPlaylist } from '../../utils/playlistPicker'
```

`onSongMore` 使用 `pickPlaylist(e.detail.song)`（无 Compat 别名）。

- [ ] **Step 2: library.wxml / library.wxss**

```xml
<!-- pages/library/library.wxml -->
<view class="lb">
  <view class="lb-tabs">
    <view class="lb-tab {{tab === 'songs' ? 'on' : ''}}" data-tab="songs" bindtap="switchTab">收藏歌曲</view>
    <view class="lb-tab {{tab === 'playlists' ? 'on' : ''}}" data-tab="playlists" bindtap="switchTab">我的歌单</view>
    <view class="lb-tab {{tab === 'recent' ? 'on' : ''}}" data-tab="recent" bindtap="switchTab">最近播放</view>
  </view>

  <view wx:if="{{!loggedIn}}" class="lb-login">
    <view class="lb-login-tip">登录后查看你的收藏、歌单和最近播放</view>
    <button class="btn-brand lb-login-btn" bindtap="goLogin">去登录</button>
  </view>

  <block wx:else>
    <view wx:if="{{tab === 'songs'}}">
      <song-item wx:for="{{collects}}" wx:key="id" song="{{item}}" index="{{index}}" playing="{{item.id === curId}}"
        list="{{collects}}" bindmore="onSongMore" />
      <view wx:if="{{!collects.length}}" class="lb-empty">还没有收藏歌曲，去首页挑几首吧</view>
    </view>

    <view wx:if="{{tab === 'playlists'}}">
      <button class="lb-create" bindtap="onCreatePlaylist">＋ 新建歌单</button>
      <view class="lb-group" wx:if="{{created.length}}"><view class="lb-group-title">我创建的</view></view>
      <view class="pl-card card" wx:for="{{created}}" wx:key="id" data-id="{{item.id}}" data-type="playlist" bindtap="onPlaylistTap">
        <image class="pl-cover" src="{{item.coverUrl}}" mode="aspectFill" />
        <view class="pl-main">
          <view class="pl-name ellipsis">{{item.name}}</view>
          <view class="pl-sub">{{item.songCount}}首 · {{item.isPublic ? '公开' : '私有'}}</view>
        </view>
        <view class="lb-del" data-id="{{item.id}}" catchtap="deletePlaylist">删除</view>
      </view>
      <view class="lb-group" wx:if="{{favorited.length}}"><view class="lb-group-title">我收藏的</view></view>
      <view class="pl-card card" wx:for="{{favorited}}" wx:key="id" data-id="{{item.id}}" data-type="playlist" bindtap="onPlaylistTap">
        <image class="pl-cover" src="{{item.coverUrl}}" mode="aspectFill" />
        <view class="pl-main">
          <view class="pl-name ellipsis">{{item.name}}</view>
          <view class="pl-sub">{{item.songCount}}首 · by {{item.creatorName || '佚名'}}</view>
        </view>
      </view>
      <view wx:if="{{!created.length && !favorited.length}}" class="lb-empty">还没有歌单，点上面新建一个</view>
    </view>

    <view wx:if="{{tab === 'recent'}}">
      <view class="lb-recent card" wx:for="{{recents}}" wx:key="songId" data-index="{{index}}" bindtap="playRecent">
        <image class="pl-cover" src="{{item.coverUrl}}" mode="aspectFill" />
        <view class="pl-main">
          <view class="pl-name ellipsis {{item.songId === curId ? 'on' : ''}}">{{item.name}}</view>
          <view class="pl-sub ellipsis">{{item.singer}} · {{item.durText}}</view>
        </view>
      </view>
      <view wx:if="{{!recents.length}}" class="lb-empty">还没有播放记录</view>
    </view>
  </block>

  <mini-player />
</view>
```

```css
/* pages/library.wxss */
.lb { padding: 20rpx 20rpx 200rpx; }
.lb-tabs { display: flex; margin-bottom: 24rpx; }
.lb-tab { flex: 1; text-align: center; padding: 18rpx 0; color: var(--text-sub); border-bottom: 4rpx solid transparent; }
.lb-tab.on { color: var(--brand); border-color: var(--brand); font-weight: 700; }
.lb-login { text-align: center; padding: 120rpx 0; }
.lb-login-tip { color: var(--text-sub); margin-bottom: 40rpx; }
.lb-login-btn { width: 300rpx; }
.lb-empty { text-align: center; color: var(--text-sub); padding: 80rpx 0; }
.lb-create { background: var(--card); color: var(--brand); font-weight: 700; border-radius: 16rpx; margin-bottom: 24rpx; }
.lb-group-title { font-size: 26rpx; color: var(--text-sub); margin: 24rpx 8rpx 16rpx; }
.lb-del { color: #d0453c; font-size: 24rpx; padding: 12rpx; }
.pl-card { display: flex; align-items: center; padding: 16rpx 20rpx; margin-bottom: 16rpx; }
.pl-cover { width: 96rpx; height: 96rpx; border-radius: 12rpx; background: var(--line); flex-shrink: 0; }
.pl-main { flex: 1; min-width: 0; margin-left: 20rpx; }
.pl-name { font-size: 30rpx; font-weight: 600; }
.pl-name.on { color: var(--brand); }
.pl-sub { font-size: 24rpx; color: var(--text-sub); margin-top: 4rpx; }
.lb-recent { display: flex; align-items: center; padding: 16rpx 20rpx; margin-bottom: 16rpx; }
```

- [ ] **Step 3: mine.json / mine.ts / mine.wxml / mine.wxss**

`mine.json`：

```json
{ "navigationBarTitleText": "悦享音乐 · 我的", "usingComponents": {} }
```

```ts
// pages/mine/mine.ts
// 我的：用户信息卡 + 退出登录（设置类功能按设计裁剪，仅保留最小闭环）
import { api } from '../../services/api'
import { auth } from '../../services/auth'

const ROLE_TEXT: Record<number, string> = { 0: '普通用户', 1: '歌手', 2: '管理员' }

Page({
  data: { user: null as any, loggedIn: false, roleText: '' },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn, user: (auth.get() && auth.get()!.user) || null })
    if (loggedIn) {
      // 刷新最新资料（头像/昵称可能在他端改过）
      api.userInfo().then((u: any) => {
        auth.save(auth.getToken(), u)
        this.setData({ user: { ...u, avatar: u.avatar }, roleText: ROLE_TEXT[u.role] || '普通用户' })
      }).catch(() => {})
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async onLogout() {
    const that = this
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.logout()
        } catch (e) {}
        auth.clear()
        that.setData({ loggedIn: false, user: null })
        wx.showToast({ title: '已退出', icon: 'none' })
      }
    })
  }
})
```

`mine.wxml`：

```xml
<!-- pages/mine/mine.wxml -->
<view class="mn">
  <view wx:if="{{!loggedIn}}" class="mn-login card">
    <view class="mn-tip">登录悦享音乐，同步你的收藏与歌单</view>
    <button class="btn-brand mn-btn" bindtap="goLogin">立即登录</button>
  </view>

  <view wx:else class="mn-card card">
    <image class="mn-avatar" src="{{user.avatar}}" mode="aspectFill" />
    <view class="mn-info">
      <view class="mn-name">{{user.nickname}}</view>
      <view class="mn-role">{{roleText}} · {{user.username}}</view>
    </view>
  </view>

  <view wx:if="{{loggedIn}}" class="mn-actions card">
    <button class="mn-logout" bindtap="onLogout">退出登录</button>
  </view>
</view>
```

```css
/* pages/mine/mine.wxss */
.mn { padding: 40rpx 20rpx 200rpx; }
.mn-login { text-align: center; padding: 80rpx 30rpx; }
.mn-tip { color: var(--text-sub); margin-bottom: 40rpx; }
.mn-btn { width: 300rpx; }
.mn-card { display: flex; align-items: center; padding: 40rpx 30rpx; }
.mn-avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: var(--line); }
.mn-info { margin-left: 24rpx; }
.mn-name { font-size: 36rpx; font-weight: 800; }
.mn-role { font-size: 24rpx; color: var(--text-sub); margin-top: 8rpx; }
.mn-actions { margin-top: 24rpx; padding: 10rpx; }
.mn-logout { background: transparent; color: #d0453c; font-size: 28rpx; }
```

- [ ] **Step 4: 类型检查**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): 音乐库（收藏/歌单/最近播放）与我的页"
```

---

### Task 11: 端到端冒烟验证（curl 对照接口）+ 收尾

**Files:**
- Modify: 按冒烟结果修复问题（如有）
- Create: `MusicDreamer-miniprogram/README.md`（开发者工具导入说明）

**Interfaces:**
- Consumes: 已部署后端 `http://106.55.3.235`；本计划所有任务产物
- Produces: README（导入步骤：微信开发者工具 → 导入项目 → 选 `MusicDreamer-miniprogram` 目录 → appid 用测试号或点"使用测试号" → 详情/本地设置勾选"不校验合法域名"）+ 全部接口冒烟通过的结论

- [ ] **Step 1: curl 冒烟——模拟小程序的全部数据路径**

用 admin 账号登录拿 token（`remember:true`），逐个跑下面命令并核对返回 `code:0` 与 data 结构（这些就是小程序页面的实际请求）：

```bash
BASE=http://106.55.3.235/api/v1
# 1 匿名：首页三块
curl -s "$BASE/recommend/list?limit=10" | head -c 300; echo
curl -s "$BASE/song/chart?type=hot&limit=10" | head -c 300; echo
curl -s "$BASE/song/chart?type=rise&limit=10" | head -c 300; echo
# 2 匿名：广场
curl -s "$BASE/search/styles" | head -c 200; echo
curl -s "$BASE/search/by-style?page=1&size=20" | head -c 300; echo
curl -s "$BASE/search/songs?keyword=七里香" | head -c 300; echo
curl -s "$BASE/playlist/public/list?page=1&size=20" | head -c 300; echo
curl -s "$BASE/album/public/list?page=1&size=20" | head -c 300; echo
# 3 登录 + 登录态接口
TOKEN=$(curl -s -X POST "$BASE/user/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123","remember":true}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
echo "token: ${TOKEN:0:20}..."
AUTH="Authorization: Bearer $TOKEN"
curl -s -H "$AUTH" "$BASE/user/info" | head -c 200; echo
curl -s -H "$AUTH" "$BASE/collect/list?page=1&size=20" | head -c 300; echo
curl -s -H "$AUTH" "$BASE/collect/ids" | head -c 200; echo
curl -s -H "$AUTH" "$BASE/playlist/my" | head -c 300; echo
curl -s -H "$AUTH" "$BASE/music/recent?limit=20" | head -c 300; echo
# 4 播放数据（匿名）
curl -s "$BASE/song/play/1" | head -c 300; echo
# 5 静态资源与歌词可达性
curl -sI "http://106.55.3.235/data/music/七里香.mp3" | head -3
```

Expected: 全部 HTTP 200 且 `code:0`；`/song/play/1` 若歌曲 id=1 不存在则换 `song/chart` 返回里任一 id。`七里香.mp3` 换成 `/data/music/` 下实际存在的文件（先 `curl -s "$BASE/song/chart?type=hot&limit=1"` 取 fileUrl 再 curl -I）。

注意 Windows Git Bash 下 `python3` 可能不存在——若失败改用 `python` 或：
```bash
TOKEN=$(curl -s -X POST "$BASE/user/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123","remember":true}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
```

- [ ] **Step 2: 全项目类型检查终验**

Run: `cd "C:\Users\34392\Desktop\项目3\MusicDreamer-miniprogram" && npx -y typescript@5 tsc --noEmit`
Expected: 无输出（0 错误）

- [ ] **Step 3: 写 README.md**

```markdown
# MusicDreamer 微信小程序（听歌用户版）

原生 TypeScript 微信小程序，对接已部署后端 http://106.55.3.235。

## 导入运行

1. 打开微信开发者工具 → 导入项目 → 选择本目录（`MusicDreamer-miniprogram`）
2. AppID：填自己的小程序 AppID，或点「使用测试号」
3. 导入后：右上角「详情 → 本地设置」勾选 **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**（后端目前是 HTTP）
4. 编译即可运行。首次使用请先注册账号（需到邮箱点激活链接），或用已有账号登录

## 功能

- 账密登录 / 注册 / 找回密码
- 首页：个性化推荐 + 热歌榜 + 飙升榜
- 广场：歌曲搜索、曲风筛选、公开歌单、公开专辑
- 播放页：进度拖拽、上/下一首、顺序/单曲循环/随机、歌词同步滚动、收藏
- 全局迷你播放条，后台/锁屏继续播放（系统播放器可控制）
- 音乐库：收藏歌曲、我的歌单（创建/删除/加歌/删歌）、收藏的歌单、最近播放
- 我的：用户信息、退出登录

## 目录结构

- `config.ts` 后端地址配置
- `services/` api 请求层、全局播放器、登录态、pub/sub store、LRC 解析
- `components/` song-item 歌曲行、mini-player 迷你播放条
- `pages/` login / home / square / library / mine / playlist / playing

## 已知边界

- 后端为 HTTP，真机预览需在手机上允许不安全网络（开发调试模式）；正式上线需配置 HTTPS 域名
- 评论、举报、上传、管理端等功能在网页端，未纳入小程序（课设分工）
```

- [ ] **Step 4: 提交全部**

```bash
cd "C:\Users\34392\Desktop\项目3" && git add MusicDreamer-miniprogram && git commit -m "feat(mini): README 与端到端冒烟收尾"
```

- [ ] **Step 5: 用户验收引导**

告知用户：
1. 微信开发者工具导入 `MusicDreamer-miniprogram`，勾选"不校验合法域名"
2. 按设计文档测试清单手测（注册→登录→榜单点歌→播放页歌词→歌单管理→收藏→最近播放→退出）
3. 若真机预览播放无声：检查手机网络能访问 106.55.3.235（同局域网外网均可）

---

## Self-Review 结论

- **Spec 覆盖**：设计文档功能清单 7 模块 → Task 5(账号) / Task 6(首页发现) / Task 7(广场) / Task 8(歌单专辑) / Task 9(播放) / Task 10(音乐库+我的) / Task 11(验证)。歌词滚动、播放上报、三模式、后台播放、mini 播放条、未登录引导、2006 踢回登录均在 Task 3/2 落地。无缺口。
- **占位符扫描**：无 TBD/TODO；所有代码步骤给全量代码；Task 8/10 的"勘误"块是对同一任务内代码的修正说明，执行者按勘误后版本落地。
- **类型一致性**：`player.playQueue(songs, index)`、`pickPlaylist(song)`、`api.*` 签名在各任务间已对齐；VO 字段以后端源码核实为准写入计划头部备忘。Task 4 song-item 的 `observers.song` 里每次都调 `api.collectIds()`——列表 10 行会发 10 个请求，**执行时应在 song-item 内改为读本地缓存**：Task 2 的 api.ts 中给 `collectIds` 加模块级 30s 缓存（`let idsCache: {t: number, ids: number[]} | null`），song-item 直接 `api.collectIds()`（自带缓存），收藏/取消后清缓存（在 collectAdd/collectRemove 的 then 里置 `idsCache = null`）。此修正属于 Task 2/4 实现细节，执行时落地。
