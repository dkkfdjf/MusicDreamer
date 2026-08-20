<template>
  <div v-if="isBare" class="app-bare">
    <router-view />
  </div>
  <template v-else>
    <!-- 标题栏（参考 Sakura Echo 布局：图标+标题+口号 / 居中搜索 / 用户区） -->
    <div class="title-bar">
      <div class="title-bar-left">
        <div class="app-icon">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <rect x="3" y="10" width="3" height="9" rx="1.5" fill="var(--accent)" />
            <rect x="8" y="5" width="3" height="18" rx="1.5" fill="var(--accent)" />
            <rect x="13" y="8" width="3" height="12" rx="1.5" fill="var(--accent)" />
            <rect x="18" y="3" width="3" height="20" rx="1.5" fill="var(--accent)" />
          </svg>
        </div>
        <div class="app-title">Music Dreamer</div>
        <div class="app-slogan">悦享音乐，让每一首歌都被听见</div>
      </div>
      <div class="title-bar-center">
        <div class="search-container">
          <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input v-model="keyword" type="text" placeholder="搜索歌曲或歌手..." aria-label="搜索"
            @keyup.enter="doSearch" />
        </div>
      </div>
      <div class="title-bar-right">
        <div v-if="user.isLogin" class="user-chip" title="退出登录" @click="logout">
          <span class="avatar">{{ (user.nickname || user.userId || '?').toString().slice(0, 1) }}</span>
          <span class="nick">{{ user.displayName }}</span>
          <span class="role-tag">{{ roleLabel }}</span>
        </div>
        <button v-else class="btn btn-primary" style="padding: 5px 14px" @click="$router.push('/login')">
          登录
        </button>
      </div>
    </div>

    <!-- 主容器：侧栏 + 内容 -->
    <div class="main-container">
      <SideNav />
      <main class="content">
        <router-view />
      </main>
    </div>

    <PlayerBar />
    <DesktopLyrics v-if="lyricsVisible" @close="lyricsVisible = false" />
    <SingerApplyDialog v-model="applyVisible" />
  </template>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SideNav from './components/SideNav.vue'
import PlayerBar from './components/PlayerBar.vue'
import DesktopLyrics from './components/DesktopLyrics.vue'
import SingerApplyDialog from './components/SingerApplyDialog.vue'
import api from './api'
import { usePlayerStore } from './stores/player'
import { useUserStore } from './stores/user'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const user = useUserStore()
const keyword = ref('')
const applyVisible = ref(false)
const lyricsVisible = ref(false)

const isBare = computed(() => !!route.meta.bare)
const roleLabel = computed(() => ({ 0: '听众', 1: '歌手', 2: '管理员' }[user.role] || '听众'))

watch(
  () => route.query.keyword,
  (v) => {
    if (route.path === '/search') keyword.value = v || ''
  },
  { immediate: true }
)

// 侧栏"歌手认证"与"桌面歌词"入口（事件总线式简单通信）
if (typeof window !== 'undefined') {
  window.addEventListener('md-open-singer-apply', () => { applyVisible.value = true })
  window.addEventListener('md-toggle-lyrics', (e) => {
    lyricsVisible.value = !!(e.detail && e.detail.on)
  })
}

function doSearch() {
  const kw = (keyword.value || '').trim()
  if (!kw) {
    ElMessage.warning('请输入搜索内容')
    return
  }
  router.push({ path: '/search', query: { keyword: kw } })
}

function logout() {
  ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
    .then(async () => {
      try {
        await api.logout()
      } catch (e) {
        /* token 失效时忽略 */
      }
      user.clear()
      player.stop()
      ElMessage.success('已退出登录')
      router.push('/login')
    })
    .catch(() => {})
}

onMounted(() => {
  player.initAudio()
  if (user.isLogin) {
    user.refreshInfo()
    user.loadCollectIds()
  }
})
</script>

<style scoped>
.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.role-tag {
  font-size: 10px;
  color: var(--text-faint);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 16px;
}
</style>
