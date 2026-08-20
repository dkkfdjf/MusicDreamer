<template>
  <div>
    <header class="content-header">
      <div class="view-title">
        <h1>最近播放</h1>
        <span>{{ songs.length }} 个条目</span>
      </div>
      <div class="view-actions">
        <button class="icon-btn action-btn" title="随机播放全部" @click="shuffleAll">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16,3 21,3 21,8" /><path d="M4 20L21 3" />
            <polyline points="21,16 21,21 16,21" /><path d="M15 15l6 6" /><path d="M4 4l5 5" />
          </svg>
          <span>随机播放</span>
        </button>
      </div>
    </header>

    <div class="songs-container">
      <div class="songs-header recent-cols">
        <div class="song-col-cover"></div>
        <div class="song-col-title">标题</div>
        <div class="song-col-artist">艺术家</div>
        <div class="song-col-duration">时长</div>
        <div class="song-col-plays">操作</div>
      </div>
      <div class="songs-list">
        <div v-for="(row, i) in songs" :key="row.id + '-' + i" class="song-item recent-cols"
          :class="{ playing: playerStore.current && playerStore.current.id === row.id }"
          @dblclick="play(i)">
          <div class="song-cover">
            <el-image v-if="row.coverUrl" :src="resolveFileUrl(row.coverUrl)" fit="cover"
              style="width: 44px; height: 44px; border-radius: 9px">
              <template #error><div class="cover cover-ph">♪</div></template>
            </el-image>
            <div v-else class="cover cover-ph">♪</div>
          </div>
          <div class="song-info">
            <div class="song-title">{{ row.name }}</div>
          </div>
          <div class="song-artist">{{ singerName(row) }}</div>
          <div class="song-duration">{{ fmtDuration(row.duration) }}</div>
          <div class="song-plays ops">
            <button class="op-btn" title="播放" @click.stop="play(i)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <button class="op-btn" :class="{ on: userStore.isCollected(row.id) }"
              :title="userStore.isCollected(row.id) ? '取消收藏' : '收藏'" @click.stop="toggleCollect(row)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="!songs.length && !loading" class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.5" />
            <polyline points="12,6 12,12 16,14" stroke="var(--accent)" stroke-width="1.5" />
          </svg>
        </div>
        <h3>还没有播放记录</h3>
        <p>去首页听几首歌，这里就会出现你的足迹</p>
        <div class="empty-actions">
          <button class="btn btn-primary" @click="$router.push('/')">去首页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import { useUserStore } from '../stores/user'
import { usePlayerStore } from '../stores/player'
import { listOf, resolveFileUrl, singerName, fmtDuration } from '../utils'

const userStore = useUserStore()
const playerStore = usePlayerStore()
const songs = ref([])
const loading = ref(false)

function play(index) {
  playerStore.playQueue(songs.value, index)
}

function shuffleAll() {
  if (!songs.value.length) return
  playerStore.playQueue(songs.value, Math.floor(Math.random() * songs.value.length))
  playerStore.mode = 3
}

async function toggleCollect(row) {
  await userStore.toggleCollect(row.id)
}

onMounted(async () => {
  loading.value = true
  try {
    songs.value = listOf(await api.recentPlays(50))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.recent-cols {
  grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1fr) 56px 70px;
}
.song-info {
  min-width: 0;
}
.song-info .song-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-artist,
.song-duration {
  font-size: 12.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ops {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.song-item:hover .ops,
.ops:focus-within {
  opacity: 1;
}
.op-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.op-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.op-btn.on {
  color: var(--accent);
}
</style>
