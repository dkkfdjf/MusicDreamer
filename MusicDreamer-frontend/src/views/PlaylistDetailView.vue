<template>
  <div class="pl-detail" v-loading="loading">
    <div class="pl-head" v-if="playlist">
      <el-image :src="resolveFileUrl(playlist.coverUrl)" fit="cover" class="pl-cover">
        <template #error><div class="pl-cover cover-ph">♪</div></template>
      </el-image>
      <div class="pl-meta">
        <h2>{{ playlist.name }}</h2>
        <p class="desc">{{ playlist.description || '暂无描述' }}</p>
        <div>
          <el-button type="primary" :disabled="!songs.length" @click="playerStore.playQueue(songs, 0)">
            播放全部
          </el-button>
          <el-button v-if="userStore.isLogin" @click="toggleFavorite">
            {{ favorited ? '取消收藏歌单' : '收藏歌单' }}
          </el-button>
          <el-button v-if="isOwner" type="danger" plain @click="remove">删除歌单</el-button>
        </div>
      </div>
    </div>

    <el-table :data="songs" empty-text="歌单还没有歌曲">
      <el-table-column type="index" width="60" align="center" />
      <el-table-column label="歌曲" min-width="220">
        <template #default="{ row }">
          <span class="song-name">{{ row.name }}</span>
          <span class="song-sub"> - {{ singerName(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="时长" width="90">
        <template #default="{ row }">{{ fmtDuration(row.duration) }}</template>
      </el-table-column>
      <el-table-column width="150" align="center">
        <template #default="{ $index }">
          <el-button size="small" type="primary" circle @click="playerStore.playQueue(songs, $index)">
            <el-icon><VideoPlay /></el-icon>
          </el-button>
          <el-button v-if="isOwner" size="small" type="danger" circle plain @click="removeSong(row, $index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VideoPlay, Delete } from '@element-plus/icons-vue'
import api from '../api'
import { useUserStore } from '../stores/user'
import { usePlayerStore } from '../stores/player'
import { playlistSongs, resolveFileUrl, singerName, fmtDuration } from '../utils'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const playerStore = usePlayerStore()
const playlist = ref(null)
const songs = ref([])
const favorited = ref(false)
const loading = ref(false)

const isOwner = computed(() =>
  userStore.isLogin && playlist.value && Number(playlist.value.userId) === Number(userStore.userId))

async function load() {
  loading.value = true
  try {
    const data = await api.getPlaylist(route.params.id)
    playlist.value = data && data.playlist ? data.playlist : data
    songs.value = playlistSongs(data)
    const mine = userStore.isLogin ? await api.myPlaylists() : null
    if (mine && mine.favorited) {
      favorited.value = listOf(mine.favorited).some((p) => Number(p.id) === Number(route.params.id))
    }
  } finally {
    loading.value = false
  }
}

async function toggleFavorite() {
  if (favorited.value) await api.unfavoritePlaylist(route.params.id)
  else await api.favoritePlaylist(route.params.id)
  favorited.value = !favorited.value
  ElMessage.success(favorited.value ? '已收藏歌单' : '已取消收藏')
}

async function remove() {
  await ElMessageBox.confirm('删除歌单将同时移除其中歌曲关联，确认删除？', '提示', { type: 'warning' })
  await api.deletePlaylist(route.params.id)
  ElMessage.success('已删除')
  router.push('/my/playlists')
}

async function removeSong(row) {
  await api.removePlaylistSong(route.params.id, row.id)
  ElMessage.success('已移除')
  load()
}

function listOf(x) { return x == null ? [] : Array.isArray(x) ? x : (x.records || x.list || []) }

watch(() => route.params.id, load, { immediate: true })
</script>

<style scoped>
.pl-head { display: flex; gap: 18px; margin-bottom: 18px; }
.pl-cover { width: 140px; height: 140px; border-radius: 10px; flex: none; }
.cover-ph { display: flex; align-items: center; justify-content: center; background: #f0f2f5; color: #c0c4cc; font-size: 30px; }
.pl-meta h2 { margin: 0 0 8px; }
.desc { color: #909399; font-size: 13px; margin-bottom: 14px; }
.song-name { font-weight: 600; }
.song-sub { color: #909399; font-size: 12px; }
</style>
