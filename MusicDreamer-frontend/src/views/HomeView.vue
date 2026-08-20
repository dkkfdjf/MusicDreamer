<template>
  <div>
    <!-- 公告 -->
    <div v-for="a in announcements" :key="a.id" class="ann-line" :title="a.title">
      <span class="ann-badge">公告</span>
      <span class="ann-text">{{ a.title }}：{{ a.content }}</span>
    </div>

    <!-- 内容头部（参考 content-header） -->
    <header class="content-header">
      <div class="view-title">
        <h1>{{ currentTitle }}</h1>
        <span>{{ songs.length }} 个条目</span>
      </div>
      <div class="view-actions">
        <button v-for="t in tabs" :key="t.key" class="icon-btn action-btn" :class="{ on: tab === t.key }"
          @click="switchTab(t.key)">
          <span>{{ t.label }}</span>
        </button>
        <button class="icon-btn action-btn" title="随机播放全部" @click="shuffleAll">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16,3 21,3 21,8" /><path d="M4 20L21 3" />
            <polyline points="21,16 21,21 16,21" /><path d="M15 15L21 21" /><path d="M4 4L9 9" />
          </svg>
          <span>随机播放</span>
        </button>
      </div>
    </header>

    <!-- 歌曲列表（参考 songs-container 五列网格） -->
    <div class="songs-container">
      <div class="songs-header home-cols">
        <div class="song-col-cover"></div>
        <div class="song-col-title">标题</div>
        <div class="song-col-artist">艺术家</div>
        <div class="song-col-duration">时长</div>
        <div class="song-col-plays">操作</div>
      </div>
      <div class="songs-list" role="listbox" aria-label="内容列表">
        <div v-for="(row, i) in songs" :key="row.id" class="song-item home-cols"
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
            <div class="menu-wrap">
              <button class="op-btn" title="加入歌单" @click.stop="menuSong = menuSong === row.id ? null : row.id">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div v-if="menuSong === row.id" class="menu-pop">
                <div v-for="p in myPlaylists" :key="p.id" class="menu-item"
                  @click="addToPlaylist(p.id, row.id)">{{ p.name }}</div>
                <div v-if="!myPlaylists.length" class="menu-item muted">先去创建歌单</div>
              </div>
            </div>
            <button class="op-btn" title="举报"
              @click.stop="reportTarget = { targetType: 1, targetId: row.id, label: row.name }">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态（参考 empty-state） -->
      <div v-if="!songs.length && !loading" class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="10" width="3" height="9" rx="1.5" fill="var(--accent)" opacity="0.85" />
            <rect x="8" y="5" width="3" height="18" rx="1.5" fill="var(--accent)" opacity="0.85" />
            <rect x="13" y="8" width="3" height="12" rx="1.5" fill="var(--accent)" opacity="0.85" />
            <rect x="18" y="3" width="3" height="20" rx="1.5" fill="var(--accent)" opacity="0.85" />
          </svg>
        </div>
        <h3>{{ userStore.isLogin ? '还没有内容' : '登录后效果更佳' }}</h3>
        <p>听歌、收藏、创建歌单，或成为歌手发布你的作品</p>
        <div class="empty-slogan">♪ 悦享音乐，让每一首歌都被听见 ♪</div>
        <div class="empty-actions">
          <button v-if="!userStore.isLogin" class="btn btn-primary" @click="$router.push('/login')">登录</button>
          <button class="btn btn-secondary" @click="$router.push('/search')">去搜索</button>
        </div>
      </div>
    </div>

    <ReportDialog v-model="reportVisible" :target="reportTarget" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../api'
import { useUserStore } from '../stores/user'
import { usePlayerStore } from '../stores/player'
import { listOf, resolveFileUrl, singerName, fmtDuration } from '../utils'
import ReportDialog from '../components/ReportDialog.vue'

const userStore = useUserStore()
const playerStore = usePlayerStore()
const tabs = [
  { key: 'reco', label: '为你推荐' },
  { key: 'hot', label: '热歌榜' },
  { key: 'rise', label: '飙升榜' }
]
const tab = ref('reco')
const songs = ref([])
const loading = ref(false)
const announcements = ref([])
const myPlaylists = ref([])
const reportVisible = ref(false)
const reportTarget = ref(null)
const menuSong = ref(null)

const currentTitle = computed(() => (tabs.find((t) => t.key === tab.value) || {}).label || '')

function switchTab(key) {
  tab.value = key
  loadTab()
}

function play(index) {
  playerStore.playQueue(songs.value, index)
}

function shuffleAll() {
  if (!songs.value.length) return
  const idx = Math.floor(Math.random() * songs.value.length)
  playerStore.playQueue(songs.value, idx)
  playerStore.mode = 3
}

async function toggleCollect(row) {
  await userStore.toggleCollect(row.id)
}

async function addToPlaylist(pid, songId) {
  menuSong.value = null
  await api.addPlaylistSong(pid, songId)
}

async function loadTab() {
  loading.value = true
  try {
    if (tab.value === 'reco') {
      if (userStore.isLogin) {
        const reco = listOf(await api.recommendList(20))
        songs.value = reco.length ? reco : listOf(await api.songChart({ type: 'hot', limit: 20 }))
      } else {
        songs.value = listOf(await api.songChart({ type: 'hot', limit: 20 }))
      }
    } else {
      songs.value = listOf(await api.songChart({ type: tab.value, limit: 20 }))
    }
  } finally {
    loading.value = false
  }
}

async function loadMyPlaylists() {
  if (!userStore.isLogin) return
  const data = await api.myPlaylists()
  myPlaylists.value = listOf(data && (data.created || data))
}

onMounted(async () => {
  listOf(await api.announcementList()).forEach((a) => announcements.value.push(a))
  loadMyPlaylists()
  loadTab()
})

watch(reportTarget, (v) => { reportVisible.value = !!v })
</script>

<style scoped>
.ann-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  margin-bottom: 8px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.ann-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 4px;
  padding: 1px 6px;
}
.ann-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 参考五列 + 操作列（44 / 2fr / 1fr / 56px / 132px） */
.home-cols {
  grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1fr) 56px 132px;
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

.menu-wrap {
  position: relative;
}
.menu-pop {
  position: absolute;
  right: 0;
  top: 28px;
  min-width: 120px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  padding: 4px;
  z-index: 50;
}
.menu-item {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
}
.menu-item:hover {
  background: var(--surface-hover);
}
</style>
