<template>
  <aside class="sidebar">
    <nav class="sidebar-nav">
      <div class="nav-section-title">发现</div>
      <router-link v-for="n in libNavs" :key="n.to" :to="n.to" class="nav-item"
        :class="{ active: isActive(n.to) }">
        <span class="nav-icon" v-html="n.icon"></span>
        <span class="nav-text">{{ n.text }}</span>
      </router-link>

      <template v-if="user.isLogin">
        <div class="nav-section-title">我的音乐</div>
        <router-link to="/my/playlists" class="nav-item" :class="{ active: isActive('/my/playlists') }">
          <span class="nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span class="nav-text">我的歌单</span>
        </router-link>

        <div class="sidebar-footer">
          <div class="nav-section-title" style="padding-left: 0">工具</div>
          <div class="nav-item" :class="{ active: lyricsOn }" title="悬浮歌词（播放时显示当前句）"
            @click="toggleLyrics">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </span>
            <span class="nav-text">桌面歌词</span>
          </div>
          <div class="nav-section-title" style="padding-left: 0; margin-top: 6px">创作</div>
          <router-link v-if="user.isSinger" to="/upload" class="nav-item"
            :class="{ active: isActive('/upload') }">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <span class="nav-text">上传中心</span>
          </router-link>
          <div v-else-if="user.role === 0" class="nav-item" @click="openApply">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </span>
            <span class="nav-text">歌手认证</span>
          </div>
          <router-link v-if="user.isAdmin" to="/admin" class="nav-item"
            :class="{ active: isActive('/admin') }">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span class="nav-text">管理后台</span>
          </router-link>
        </div>
      </template>
    </nav>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'

const route = useRoute()
const user = useUserStore()
const lyricsOn = ref(false)

function toggleLyrics() {
  lyricsOn.value = !lyricsOn.value
  window.dispatchEvent(new CustomEvent('md-toggle-lyrics', { detail: { on: lyricsOn.value } }))
}

const libNavs = [
  {
    to: '/',
    text: '全部内容',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
  },
  {
    to: '/recent',
    text: '最近播放',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>'
  },
  {
    to: '/search',
    text: '搜索',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
  }
]

function isActive(path) {
  return route.path === path
}

function openApply() {
  window.dispatchEvent(new Event('md-open-singer-apply'))
}
</script>
