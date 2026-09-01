# 单击播放条头像开关歌词面板 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 单击播放条左下角"正在播放歌曲"的封面头像，开关右侧歌词面板（与「詞」按钮等价的第二个入口）。

**Architecture:** 仅改 `src/components/PlayerBar.vue` 一个文件。给 `.track .cv` 封面容器绑定 `@click`，有歌时调用现有的 `lyrics.togglePanel()`；title 与 cursor 跟随状态。不新增状态、不改 store、不改 LyricsPanel——两个入口驱动同一个 `panelOpen`。

**Tech Stack:** Vue 3 `<script setup>` + Pinia。项目无测试框架（package.json 只有 dev/build/preview），验证走 `npm run dev` 手动验证清单 + `npm run build` 确认编译。

**Spec:** `docs/specs/2026-09-01-player-cover-click-lyrics-design.md`

## Global Constraints

- 交互规范（来自 spec，逐字）：
  - 未播放任何歌曲（`player.current` 为空）→ 单击忽略，无任何反应
  - 有歌、面板关闭 → 打开右侧歌词面板
  - 有歌、面板已开 → 关闭面板（toggle 对称）
- 明确不做：不改首页歌曲卡片/hero 轮播；不接 `DesktopLyrics.vue`
- 遵循文件内现有注释风格（中文注释、说明"为什么"）
- 提交信息用中文、遵循仓库现有 conventional 前缀（`feat:` / `fix:`）

---

### Task 1: PlayerBar.vue 单击头像开关歌词面板

**Files:**
- Modify: `src/components/PlayerBar.vue`（模板 ~第 5-9 行 `.track .cv`、脚本、样式 `.track .cv` ~第 326 行）

**Interfaces:**
- Consumes: `useLyricsStore()` 的 `togglePanel()` / `panelOpen`（`src/stores/lyrics.js:30`，已在文件中 import，第 129 行 `const lyrics = useLyricsStore()`）；`player.current`（player store）
- Produces: 无（终点交互，无后续任务依赖）

- [ ] **Step 1: 模板 — 给封面容器加 @click + 动态 title + 有歌时的 pointer class**

把 `src/components/PlayerBar.vue` 第 5-9 行：

```html
      <div class="cv">
        <img v-if="player.current && player.current.coverUrl && !coverFail"
          :src="resolveFileUrl(player.current.coverUrl)" alt="封面" @error="coverFail = true" />
        <div v-else class="ph">♪</div>
      </div>
```

改为：

```html
      <div class="cv" :class="{ tappable: !!player.current }" :title="cvTitle"
        @click="onCoverClick">
        <img v-if="player.current && player.current.coverUrl && !coverFail"
          :src="resolveFileUrl(player.current.coverUrl)" alt="封面" @error="coverFail = true" />
        <div v-else class="ph">♪</div>
      </div>
```

- [ ] **Step 2: 脚本 — 加 cvTitle computed 和 onCoverClick 函数**

在 `src/components/PlayerBar.vue` 的 `<script setup>` 中，紧跟 `const wordTitle = computed(...)` 块之后（约第 210 行后）插入：

```js
/* 封面悬停提示跟随状态：无歌不提示；有歌提示单击会发生什么 */
const cvTitle = computed(() => {
  if (!player.current) return ''
  return lyrics.panelOpen ? '单击收起歌词' : '单击显示歌词'
})

/* 单击头像 ⇄ 开关歌词面板（与「詞」按钮同驱 lyrics.panelOpen）；
   未播放时忽略 —— 没有歌就没有歌词可看 */
function onCoverClick() {
  if (player.current) lyrics.togglePanel()
}
```

- [ ] **Step 3: 样式 — 有歌时 cursor: pointer + 悬停轻微缩放**

在 `<style scoped>` 中找到 `.track .cv .ph` 规则块（约第 342-350 行），在其后插入：

```css
/* 单击头像开关歌词：仅在有歌时给可点暗示（cursor + 悬停微缩放），
   未播放时保持默认光标避免误导 */
.track .cv.tappable {
  cursor: pointer;
}
.track .cv.tappable:hover {
  transform: scale(1.03);
}
.track .cv {
  transition: transform 0.2s ease;
}
```

（`.track .cv` 已有一条既有规则块，这里的 transition 单独成块避免改动既有块内容；CSS 同名规则会合并，无冲突。）

- [ ] **Step 4: 构建验证**

Run: `cd MusicDreamer-frontend && npm run build`
Expected: 构建成功，无 Vue 模板编译错误/警告新增

- [ ] **Step 5: 手动验证**

Run: `cd MusicDreamer-frontend && npm run dev`，浏览器打开后逐条验证：

1. 播放一首歌 → 单击左下角头像 → 歌词面板从右缘展开，「詞」按钮变品牌渐变开启态
2. 再单击头像 → 面板收起，「詞」按钮回未开启态
3. 未播放时（头像显示 ♪）单击 → 无反应，鼠标悬停无 pointer 光标、无 title
4. 面板开着时点「詞」或面板右上角 × → 面板关闭（两入口状态同步）
5. 悬停头像 → 显示「单击显示歌词」/「单击收起歌词」提示

- [ ] **Step 6: Commit**

```bash
cd MusicDreamer-frontend
git add src/components/PlayerBar.vue
git commit -m "feat: 单击播放条头像开关歌词面板

与「詞」按钮同驱 lyrics.panelOpen；未播放时忽略单击。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
