<template>
  <div class="my-playlists">
    <div class="head">
      <h2>我的音乐</h2>
      <el-button type="primary" @click="createVisible = true">新建歌单</el-button>
    </div>

    <h3 class="sec">最近播放</h3>
    <el-table :data="recent" size="small" empty-text="还没有播放记录">
      <el-table-column type="index" width="50" align="center" />
      <el-table-column label="歌曲" min-width="200">
        <template #default="{ row }">
          <span class="song-name">{{ row.name }}</span>
          <span class="sub"> - {{ singerName(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column width="70" align="center">
        <template #default="{ $index }">
          <el-button size="small" type="primary" circle @click="playerStore.playQueue(recent, $index)">
            <el-icon><VideoPlay /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <h3 class="sec">我创建的歌单</h3>
    <div class="pl-grid">
      <el-card v-for="p in created" :key="p.id" class="pl-card" shadow="hover" @click="$router.push('/playlist/' + p.id)">
        <div class="pl-name">{{ p.name }}</div>
        <div class="sub">{{ p.songCount ?? 0 }} 首 · {{ p.isPublic ? '公开' : '私有' }}</div>
      </el-card>
      <el-empty v-if="!created.length" description="还没有创建歌单" :image-size="60" />
    </div>

    <h3 class="sec">我收藏的歌单</h3>
    <div class="pl-grid">
      <el-card v-for="p in collected" :key="p.id" class="pl-card" shadow="hover" @click="$router.push('/playlist/' + p.id)">
        <div class="pl-name">{{ p.name }}</div>
        <div class="sub">{{ p.songCount ?? 0 }} 首</div>
      </el-card>
      <el-empty v-if="!collected.length" description="还没有收藏歌单" :image-size="60" />
    </div>

    <el-dialog v-model="createVisible" title="新建歌单" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="歌单名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
        <el-form-item label="公开"><el-switch v-model="form.isPublic" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay } from '@element-plus/icons-vue'
import api from '../api'
import { usePlayerStore } from '../stores/player'
import { listOf, splitMyPlaylists, singerName } from '../utils'

const playerStore = usePlayerStore()
const created = ref([])
const collected = ref([])
const recent = ref([])
const createVisible = ref(false)
const form = ref({ name: '', description: '', isPublic: true })

async function create() {
  if (!form.value.name) return ElMessage.warning('请输入歌单名称')
  await api.createPlaylist(form.value)
  ElMessage.success('歌单已创建')
  createVisible.value = false
  form.value = { name: '', description: '', isPublic: true }
  load()
}

async function load() {
  const data = await api.myPlaylists()
  const s = splitMyPlaylists(data)
  created.value = s.created
  collected.value = s.collected
  recent.value = listOf(await api.recentPlays(10))
}

onMounted(load)
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; }
.sec { margin: 22px 0 10px; color: #303133; }
.pl-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.pl-card { width: 180px; cursor: pointer; }
.pl-name { font-weight: 600; margin-bottom: 4px; }
.sub { color: #909399; font-size: 12px; }
.song-name { font-weight: 600; }
</style>
