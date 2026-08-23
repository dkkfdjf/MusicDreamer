<template>
  <div class="collection" v-loading="loading">
    <header class="content-header">
      <div>
        <div class="eyebrow">Collection</div>
        <h1>我的收藏</h1>
      </div>
      <span v-if="songs.length" class="count">{{ total }} 首歌曲</span>
    </header>

    <SongGrid v-if="songs.length" :songs="songs" @play="play" />

    <div v-if="!songs.length && !loading" class="empty-state">
      <h3>还没有收藏歌曲</h3>
      <p>在首页或搜索结果中收藏喜欢的歌曲，它们会显示在这里</p>
      <button class="btn btn-primary" @click="$router.push('/')">去发现音乐</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '../api'
import SongGrid from '../components/SongGrid.vue'
import { pageOf } from '../utils'
import { usePlayerStore } from '../stores/player'

const playerStore = usePlayerStore()
const songs = ref([])
const total = ref(0)
const loading = ref(false)

function play(index) {
  playerStore.playQueue(songs.value, index)
}

onMounted(async () => {
  loading.value = true
  try {
    const result = pageOf(await api.collectList({ page: 1, size: 100 }))
    songs.value = result.list.map((song) => ({ ...song, id: song.id != null ? song.id : song.songId }))
    total.value = result.total
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.collection { animation: v2-rise 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
.content-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 30px 0 22px; }
.eyebrow { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.eyebrow::before { content: ''; width: 22px; height: 1px; background: var(--accent); }
h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.count { color: var(--text-muted); font-family: var(--font-mono); font-size: 12px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 70px 0 40px; text-align: center; }
.empty-state h3 { font-size: 17px; font-weight: 700; }
.empty-state p { color: var(--text-muted); font-size: 13.5px; }
.empty-state .btn { margin-top: 14px; }
</style>
