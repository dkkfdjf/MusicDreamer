<template>
  <div class="my-playlists">
    <div class="page-head">
      <div>
        <div class="eyebrow">Library · 音乐库</div>
        <h1>我的歌单</h1>
      </div>
      <button class="btn btn-primary" @click="createVisible = true">＋ 新建歌单</button>
    </div>

    <!-- 收藏 ≠ 歌单：单曲收藏只在侧栏「我的收藏」与爱心按钮中体现，不进歌单页 -->

    <div class="section-title">我创建的歌单<span class="grow"></span></div>
    <div class="pl-grid" ref="createdEl">
      <div v-for="p in created" :key="p.id" class="pl-card" @click="$router.push('/playlist/' + p.id)">
        <div class="pl-cover" :class="'c' + ((Number(p.id || 0) % 6) + 1)">♪</div>
        <div class="pl-name">{{ p.name }}</div>
        <div class="pl-meta">{{ p.songCount ?? 0 }} 首 · {{ p.isPublic ? '公开' : '私有' }}</div>
      </div>
    </div>
    <div v-if="!created.length" class="empty-state">
      <h3>还没有创建歌单</h3>
      <p>把喜欢的歌编成一张歌单，随时整张播放。</p>
      <button class="btn btn-primary" @click="createVisible = true">新建歌单</button>
    </div>

    <div class="section-title">我收藏的歌单<span class="grow"></span></div>
    <div class="pl-grid" ref="collectedEl">
      <!-- 收藏 = 引用别人的公开歌单：♥ 标记；源歌单增删歌曲/取消公开会随之变化 -->
      <div v-for="p in collected" :key="p.id" class="pl-card collected" @click="$router.push('/playlist/' + p.id)">
        <div class="pl-cover" :class="'c' + ((Number(p.id || 0) % 6) + 1)">
          ♪
          <span class="fav-chip">♥ 收藏</span>
        </div>
        <div class="pl-name">{{ p.name }}</div>
        <div class="pl-meta">{{ p.songCount ?? 0 }} 首</div>
      </div>
    </div>
    <div v-if="!collected.length" class="empty-state">
      <h3>还没有收藏歌单</h3>
      <p>在公开歌单页点收藏，就能把别人的好歌单存到这里。</p>
    </div>

    <div class="spacer"></div>

    <el-dialog v-model="createVisible" title="新建歌单" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="歌单名称"><el-input v-model="form.name" placeholder="给歌单起个名字" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" placeholder="可选" /></el-form-item>
        <el-form-item label="公开"><el-switch v-model="form.isPublic" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="create">创建歌单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { message } from '../utils/feedback'
import api from '../api'
import { splitMyPlaylists } from '../utils'
import { revealStagger } from '../utils/motion'

const created = ref([])
const collected = ref([])
const createVisible = ref(false)
const form = ref({ name: '', description: '', isPublic: true })
const createdEl = ref(null)
const collectedEl = ref(null)

async function create() {
  if (!form.value.name) return message.warning('请输入歌单名称')
  await api.createPlaylist(form.value)
  message.success('歌单已创建')
  window.dispatchEvent(new Event('md-playlists-changed'))
  createVisible.value = false
  form.value = { name: '', description: '', isPublic: true }
  load()
}

async function load() {
  const data = await api.myPlaylists()
  const s = splitMyPlaylists(data)
  created.value = s.created
  collected.value = s.collected
  await nextTick()
  if (createdEl.value) revealStagger(createdEl.value.querySelectorAll('.pl-card'), { y: 14, stagger: 0.04 })
  if (collectedEl.value) revealStagger(collectedEl.value.querySelectorAll('.pl-card'), { y: 14, stagger: 0.04 })
}

onMounted(load)
</script>

<style scoped>
.my-playlists { animation: v2-rise 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both; }

/* 收藏卡：洋红 ♥ 角标，与自建卡区分 */
.pl-card.collected .pl-cover { position: relative; }
.fav-chip {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.92);
  color: var(--magenta);
  font-size: 11px;
  font-weight: 700;
}

.spacer { height: 40px; }
</style>
