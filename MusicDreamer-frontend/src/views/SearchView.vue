<template>
  <div class="search">
    <el-tabs v-model="tab">
      <el-tab-pane label="歌曲" name="songs">
        <el-table :data="songs" v-loading="loading" empty-text="输入关键词搜索歌曲">
          <el-table-column label="歌曲" min-width="220">
            <template #default="{ row }">
              <div class="song-cell">
                <el-image :src="resolveFileUrl(row.coverUrl)" fit="cover" class="cover">
                  <template #error><div class="cover cover-ph">♪</div></template>
                </el-image>
                <div>
                  <div class="song-name">{{ row.name }}</div>
                  <div class="song-sub">{{ singerName(row) }}<span v-if="row.album"> · {{ row.album }}</span></div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="时长" width="80">
            <template #default="{ row }">{{ fmtDuration(row.duration) }}</template>
          </el-table-column>
          <el-table-column label="播放量" width="100" prop="playCount" />
          <el-table-column width="90" align="center">
            <template #default="{ $index }">
              <el-button size="small" type="primary" circle @click="playerStore.playQueue(songs, $index)">
                <el-icon><VideoPlay /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="page" :page-size="size" :total="total"
          layout="prev, pager, next" @current-change="doSearch" class="pager" />
      </el-tab-pane>
      <el-tab-pane label="歌手" name="singers">
        <div class="singer-grid">
          <el-card v-for="s in singers" :key="s.id" class="singer-card" shadow="hover">
            <el-avatar :size="64" :src="resolveFileUrl(s.avatar)">{{ (s.nickname || s.username || '?').slice(0, 1) }}</el-avatar>
            <div class="singer-name">{{ s.nickname || s.username }}</div>
          </el-card>
        </div>
        <el-empty v-if="!singers.length && !loading" description="暂无匹配歌手" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VideoPlay } from '@element-plus/icons-vue'
import api from '../api'
import { usePlayerStore } from '../stores/player'
import { listOf, pageOf, resolveFileUrl, singerName, fmtDuration } from '../utils'

const route = useRoute()
const playerStore = usePlayerStore()
const tab = ref('songs')
const keyword = ref('')
const songs = ref([])
const singers = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)

async function doSearch() {
  if (!keyword.value) return
  loading.value = true
  try {
    if (tab.value === 'songs') {
      const { list, total: t } = pageOf(await api.searchSongs({ keyword: keyword.value, page: page.value, size: size.value }))
      songs.value = list
      total.value = t
    } else {
      singers.value = listOf(await api.searchSingers({ keyword: keyword.value, page: 1, size: 30 }))
    }
  } finally {
    loading.value = false
  }
}

watch(() => route.query.keyword, (v) => {
  if (v) { keyword.value = String(v); page.value = 1; doSearch() }
}, { immediate: true })

watch(tab, () => doSearch())
</script>

<style scoped>
.song-cell { display: flex; align-items: center; gap: 10px; }
.cover { width: 44px; height: 44px; border-radius: 6px; flex: none; }
.cover-ph { display: flex; align-items: center; justify-content: center; background: #f0f2f5; color: #c0c4cc; }
.song-name { font-weight: 600; }
.song-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.pager { margin-top: 12px; justify-content: center; }
.singer-grid { display: flex; flex-wrap: wrap; gap: 14px; }
.singer-card { width: 140px; text-align: center; }
.singer-name { margin-top: 8px; font-weight: 600; }
</style>
