<template>
  <div class="browse-songs" v-loading="loading">
    <header class="content-header">
      <div>
        <div class="eyebrow">Library</div>
        <h1>{{ keyword ? `“${keyword}” 的结果` : '所有歌曲' }}</h1>
      </div>
      <span class="count">{{ total }} 首</span>
    </header>

    <!-- 公开歌单广场：所有用户公开的歌单在此可见（与全部歌曲同页整合） -->
    <section v-if="!keyword && plaza.length" class="plaza" aria-label="公开歌单">
      <div class="plaza-head">
        <h2>公开歌单</h2>
        <span class="plaza-sub">来自社区的创作</span>
      </div>
      <div class="plaza-grid">
        <router-link v-for="p in plaza" :key="p.id" :to="'/playlist/' + p.id" class="pl-card"
          :title="p.name">
          <div class="pl-cover">
            <img v-if="p.coverUrl" :src="resolveFileUrl(p.coverUrl)" alt="" loading="lazy"
              @error="p.coverUrl = ''">
            <span v-else class="pl-ph" :class="'c' + ((Number(p.id || 0) % 6) + 1)">♪</span>
          </div>
          <b class="pl-name">{{ p.name }}</b>
          <span class="pl-count">{{ p.songCount || 0 }} 首</span>
        </router-link>
      </div>
    </section>

    <div v-if="!keyword" class="filters" role="group" aria-label="曲风筛选">
      <button class="chip" :aria-pressed="!style" @click="selectStyle('')">全部</button>
      <button v-for="item in STYLES" :key="item" class="chip" :aria-pressed="style === item"
        @click="selectStyle(item)">{{ item }}</button>
    </div>

    <SongGrid v-if="songs.length" :songs="songs" @play="play" />

    <div v-if="!songs.length && !loading" class="empty-state">
      <h3>{{ keyword ? '没有找到匹配的歌曲' : '暂无可播放歌曲' }}</h3>
      <p>{{ keyword ? '换个关键词试试' : '稍后再来看看' }}</p>
    </div>

    <el-pagination v-if="total > size" v-model:current-page="page" :page-size="size" :total="total"
      layout="prev, pager, next" class="pager" @current-change="load" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import SongGrid from '../components/SongGrid.vue'
import { pageOf, listOf, resolveFileUrl, STYLES } from '../utils'
import { usePlayerStore } from '../stores/player'

const route = useRoute()
const playerStore = usePlayerStore()
const songs = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(24)
const style = ref('')
const keyword = ref('')
const loading = ref(false)
const plaza = ref([])

function play(index) {
  playerStore.playQueue(songs.value, index)
}

function selectStyle(value) {
  style.value = value
  page.value = 1
  load()
}

// 公开歌单广场：失败静默（老网关未放行匿名时不影响本页）
async function loadPlaza() {
  try {
    plaza.value = listOf(await api.publicPlaylists({ page: 1, size: 8 }))
  } catch (e) {
    plaza.value = []
  }
}
loadPlaza()

async function load() {
  loading.value = true
  try {
    const data = keyword.value
      ? await api.searchSongs({ keyword: keyword.value, page: page.value, size: size.value })
      : await api.searchByStyle({ style: style.value || undefined, page: page.value, size: size.value })
    const result = pageOf(data)
    songs.value = result.list
    total.value = result.total
  } finally {
    loading.value = false
  }
}

watch([() => route.query.keyword, () => route.query.style], ([keywordQuery, styleQuery]) => {
  keyword.value = typeof keywordQuery === 'string' ? keywordQuery.trim() : ''
  style.value = keyword.value ? '' : (typeof styleQuery === 'string' ? styleQuery : '')
  page.value = 1
  load()
}, { immediate: true })
</script>

<style scoped>
.browse-songs { animation: v2-rise 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
.content-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 30px 0 18px; }
.eyebrow { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.eyebrow::before { content: ''; width: 22px; height: 1px; background: var(--accent); }
h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.count { color: var(--text-muted); font-family: var(--font-mono); font-size: 12px; }

/* ---------- 公开歌单广场 ---------- */
.plaza { margin-bottom: 26px; }
.plaza-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.plaza-head h2 { font-size: 17px; font-weight: 700; }
.plaza-sub { font-size: 12.5px; color: var(--text-faint); }
.plaza-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 14px; }
.pl-card {
  display: flex; flex-direction: column; gap: 7px; padding: 9px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm); text-decoration: none; min-width: 0;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1), box-shadow 0.3s ease, border-color 0.2s ease;
}
.pl-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: rgba(0, 0, 0, 0.14); }
.pl-cover { position: relative; aspect-ratio: 1; border-radius: 9px; overflow: hidden; background: var(--surface-2); }
.pl-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pl-ph { position: absolute; inset: 0; display: grid; place-items: center; font-size: 30px; color: rgba(255, 255, 255, 0.6); }
.pl-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-count { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.chip { min-height: 34px; padding: 6px 13px; border: 1px solid var(--border); border-radius: var(--radius-pill); color: var(--text-muted); font-size: 13px; }
.chip:hover { color: var(--text); border-color: var(--border-strong); }
.chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-text); font-weight: 700; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 70px 0 40px; text-align: center; }
.empty-state h3 { font-size: 17px; }
.empty-state p { color: var(--text-muted); }
.pager { margin-top: 24px; justify-content: center; }
</style>
