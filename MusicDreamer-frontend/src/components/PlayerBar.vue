<template>
  <footer class="player-bar">
    <!-- 左：当前曲目 -->
    <div class="player-info">
      <div class="song-cover">
        <img v-if="player.current && player.current.coverUrl && !coverFail"
          :src="resolveFileUrl(player.current.coverUrl)" alt="封面" @error="coverFail = true" />
        <div v-else class="cover-ph">♪</div>
      </div>
      <div class="song-details">
        <div class="song-title">{{ player.current ? player.current.name : '未在播放' }}</div>
        <div class="song-artist">{{ player.current ? player.currentSinger : 'Music Dreamer' }}</div>
      </div>
    </div>

    <!-- 中：控制 + 进度 -->
    <div class="player-controls">
      <div class="control-buttons">
        <button class="icon-btn mode-btn" :title="player.modeLabel" @click="player.cycleMode()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <template v-if="player.mode === 1">
              <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <text x="9" y="20" font-size="11" fill="currentColor" stroke="none" font-weight="700">1</text>
            </template>
            <template v-else-if="player.mode === 3">
              <polyline points="16,3 21,3 21,8" /><path d="M4 20L21 3" />
              <polyline points="21,16 21,21 16,21" /><path d="M15 15l6 6" /><path d="M4 4l5 5" />
            </template>
            <template v-else>
              <polyline points="17,1 21,5 17,9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7,23 3,19 7,15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </template>
          </svg>
        </button>
        <button class="icon-btn transport-btn" title="上一首" @click="player.prev()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>
        <button class="icon-btn btn-play" :title="player.playing ? '暂停' : '播放'" @click="player.toggle()">
          <svg v-if="player.loading" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" class="spin">
            <path d="M21 12a9 9 0 1 1-6.2-8.56" />
          </svg>
          <svg v-else-if="player.playing" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button class="icon-btn transport-btn" title="下一首" @click="player.next(false)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
        <button class="icon-btn speed-btn" title="播放速度（点击切换）" @click="cycleRate">
          {{ rateLabel }}
        </button>
        <button class="icon-btn ab-btn" :class="{ active: player.abA !== null }"
          title="A-B 复读（第一次点设 A 点，第二次设 B 点开始循环，第三次清除）" @click="player.cycleAb()">
          {{ abLabel }}
        </button>
        <button class="icon-btn speed-btn" title="播放队列" @click="queueOpen = !queueOpen">
          队列{{ player.queue.length ? ' ' + player.queue.length : '' }}
        </button>
      </div>

      <div class="progress-container">
        <span class="time-display">{{ fmt(player.currentTime) }}</span>
        <div class="progress-bar-container" ref="barEl"
          @pointerdown="onBarDown" @pointermove="onBarMove" @pointerup="onBarUp" @pointercancel="onBarUp">
          <div class="progress-bar">
            <div class="progress-filled" :style="{ width: pct + '%' }"></div>
            <div class="progress-handle" :style="{ left: pct + '%' }"></div>
          </div>
        </div>
        <span class="time-display">{{ fmt(player.duration) }}</span>
      </div>
    </div>

    <!-- 右：音量 -->
    <div class="player-extra">
      <button class="icon-btn extra-btn" :title="muted ? '取消静音' : '静音'" @click="toggleMute">
        <svg v-if="muted || player.volume === 0" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
      <input type="range" min="0" max="100" :value="volPct" aria-label="音量" @input="onVolume" />
      <span class="volume-display">{{ volPct }}</span>
    </div>

    <!-- 播放队列浮层 -->
    <div v-if="queueOpen" class="queue-pop">
      <div v-if="!player.queue.length" class="muted" style="padding: 8px">队列为空，去首页挑一首歌吧</div>
      <div v-for="(s, i) in player.queue" :key="s.id + '-' + i" class="queue-item"
        :class="{ active: i === player.currentIndex }" @click="player.playAt(i)">
        <span class="qidx">{{ i + 1 }}</span>
        <span class="qname">{{ s.name }}</span>
        <span class="qsinger">{{ singerName(s) }}</span>
        <span class="qdel" title="移除" @click.stop="player.removeAt(i)">×</span>
      </div>
      <div v-if="player.queue.length" style="text-align: right; margin-top: 6px">
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px" @click="player.stop(true)">
          清空队列
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { resolveFileUrl, singerName } from '../utils'

const player = usePlayerStore()
const coverFail = ref(false)
const queueOpen = ref(false)
const barEl = ref(null)
const dragging = ref(false)
const muted = ref(false)
const lastVol = ref(0.8)

const pct = computed(() => {
  const d = player.duration || 0
  return d > 0 ? Math.min(100, (player.currentTime / d) * 100) : 0
})
const volPct = computed(() => Math.round((player.volume || 0) * 100))

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const rateLabel = computed(() => (Number(player.rate) || 1).toFixed(2).replace(/0$/, '') + 'x')
const abLabel = computed(() => {
  if (player.abA === null) return 'A-B'
  if (player.abB === null) return 'A·'
  return 'A-B↻'
})

function cycleRate() {
  const i = RATES.indexOf(Number(player.rate) || 1)
  player.setRate(RATES[(i + 1) % RATES.length])
}

function fmt(t) {
  const s = Math.max(0, Math.floor(t || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function ratioFromEvent(e) {
  const el = barEl.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

function onBarDown(e) {
  dragging.value = true
  player.seek(ratioFromEvent(e) * (player.duration || 0))
  if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
}
function onBarMove(e) {
  if (dragging.value) player.seek(ratioFromEvent(e) * (player.duration || 0))
}
function onBarUp() {
  dragging.value = false
}

function onVolume(e) {
  const v = Number(e.target.value) / 100
  muted.value = false
  player.setVolume(v)
  if (v > 0) lastVol.value = v
}

function toggleMute() {
  if (muted.value || player.volume === 0) {
    player.setVolume(lastVol.value || 0.8)
    muted.value = false
  } else {
    lastVol.value = player.volume
    player.setVolume(0)
    muted.value = true
  }
}
</script>

<style scoped>
.song-cover {
  width: 48px;
  height: 48px;
  border-radius: 9px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.song-cover .cover-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--accent);
  background: var(--surface-2);
}
.mode-btn:hover {
  color: var(--accent);
}
.spin {
  animation: pbspin 1s linear infinite;
}
@keyframes pbspin {
  to { transform: rotate(360deg); }
}
.progress-bar-container {
  cursor: pointer;
  touch-action: none;
}
</style>
