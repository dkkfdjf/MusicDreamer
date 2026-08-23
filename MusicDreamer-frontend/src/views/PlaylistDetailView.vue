<template>
  <div class="pl-detail" v-loading="loading">
    <div class="pl-head" v-if="playlist">
      <div class="pl-cover">
        <el-image v-if="playlist.coverUrl" :src="resolveFileUrl(playlist.coverUrl)" fit="cover"
          style="width: 100%; height: 100%">
          <template #error><span class="ph c1"></span></template>
        </el-image>
        <span v-else class="ph" :class="'c' + ((Number(playlist.id || 0) % 6) + 1)"></span>
      </div>
      <div class="pl-meta">
        <div class="eyebrow">Playlist</div>
        <h2>{{ playlist.name }}</h2>
        <p class="desc">{{ playlist.description || '暂无描述' }}</p>
        <div class="actions">
          <button class="btn btn-primary" :disabled="!songs.length" @click="playerStore.playQueue(songs, 0)">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M7 5v14l12-7z" /></svg>
            播放全部
          </button>
          <!-- 收藏是"收别人的歌单"：自己的歌单不显示收藏按钮 -->
          <button v-if="userStore.isLogin && !isOwner" class="btn btn-secondary" @click="toggleFavorite">
            {{ favorited ? '取消收藏' : '收藏歌单' }}
          </button>
          <button v-if="isOwner" class="btn btn-danger" @click="remove">删除歌单</button>
        </div>
      </div>
    </div>

    <SongGrid :songs="songs" :show-collect="userStore.isLogin" @play="(i) => playerStore.playQueue(songs, i)">
      <template #ops="{ row }">
        <button v-if="isOwner" class="op-btn" title="从歌单移除" @click.stop="removeSong(row)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </template>
    </SongGrid>

    <div v-if="!songs.length && !loading" class="empty-state">
      <h3>{{ loadError || '歌单还没有歌曲' }}</h3>
      <p>{{ loadError ? '请稍后重试，或联系管理员检查音乐服务。' : '在首页找到喜欢的歌，加入这个歌单吧' }}</p>
      <button class="btn btn-primary" @click="loadError ? load() : $router.push('/')">
        {{ loadError ? '重新加载' : '去首页选歌' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, confirm } from '../utils/feedback'
import api from '../api'
import { useUserStore } from '../stores/user'
import { usePlayerStore } from '../stores/player'
import SongGrid from '../components/SongGrid.vue'
import { playlistSongs, resolveFileUrl } from '../utils'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const playerStore = usePlayerStore()
const playlist = ref(null)
const songs = ref([])
const favorited = ref(false)
const loading = ref(false)
const loadError = ref('')

const isOwner = computed(() =>
  userStore.isLogin && playlist.value && Number(playlist.value.userId) === Number(userStore.userId))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.getPlaylist(route.params.id)
    playlist.value = data && data.playlist ? data.playlist : data
    songs.value = playlistSongs(data)
    favorited.value = !!(playlist.value && playlist.value.favored)
  } catch (e) {
    playlist.value = null
    songs.value = []
    loadError.value = (e && e.response && e.response.data && e.response.data.message)
      || (e && e.message) || '歌单加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleFavorite() {
  if (favorited.value) await api.unfavoritePlaylist(route.params.id)
  else await api.favoritePlaylist(route.params.id)
  favorited.value = !favorited.value
  window.dispatchEvent(new Event('md-playlists-changed'))
  message.success(favorited.value ? '已收藏歌单' : '已取消收藏')
}

async function remove() {
  await confirm('删除歌单将同时移除其中歌曲关联，确认删除？', { title: '删除歌单', okText: '删除' })
  await api.deletePlaylist(route.params.id)
  message.success('已删除')
  window.dispatchEvent(new Event('md-playlists-changed'))
  router.push('/my/playlists')
}

async function removeSong(row) {
  await api.removePlaylistSong(route.params.id, row.id)
  message.success('已移除')
  load()
}

watch(() => route.params.id, load, { immediate: true })
</script>

<style scoped>
.pl-detail {
  animation: v2-rise 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

.pl-head {
  display: flex;
  gap: 24px;
  padding: 30px 0 24px;
  align-items: flex-end;
}
.pl-cover {
  width: 150px;
  height: 150px;
  border-radius: var(--radius-lg);
  flex: none;
  position: relative;
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: var(--shadow-md);
}
.pl-cover .ph {
  position: absolute;
  inset: 0;
}

.pl-meta {
  flex: 1;
  min-width: 0;
}
.eyebrow {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.eyebrow::before {
  content: "";
  width: 22px;
  height: 1px;
  background: var(--accent);
}
.pl-meta h2 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.01em;
}
.desc {
  color: var(--text-muted);
  font-size: 13.5px;
  margin: 8px 0 16px;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* SongGrid ops 插槽里的移除按钮（样式与组件内 op-btn 一致） */
.op-btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.op-btn:hover {
  color: var(--error);
  border-color: rgba(255, 90, 95, 0.45);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 0 40px;
  text-align: center;
}
.empty-state h3 {
  font-size: 17px;
  font-weight: 700;
}
.empty-state p {
  font-size: 13.5px;
  color: var(--text-muted);
}
.empty-state .btn {
  margin-top: 14px;
}

@media (max-width: 720px) {
  .pl-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
