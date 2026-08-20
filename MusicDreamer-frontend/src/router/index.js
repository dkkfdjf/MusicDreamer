import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/login', name: 'login', meta: { bare: true }, component: () => import('../views/LoginView.vue') },
  { path: '/register', name: 'register', meta: { bare: true }, component: () => import('../views/RegisterView.vue') },
  { path: '/activate', name: 'activate', meta: { bare: true }, component: () => import('../views/ActivateView.vue') },
  { path: '/search', name: 'search', component: () => import('../views/SearchView.vue') },
  { path: '/playlist/:id', name: 'playlist-detail', component: () => import('../views/PlaylistDetailView.vue') },
  { path: '/my/playlists', name: 'my-playlists', component: () => import('../views/MyPlaylistsView.vue'), meta: { requiresAuth: true } },
  { path: '/recent', name: 'recent', component: () => import('../views/RecentView.vue'), meta: { requiresAuth: true } },
  { path: '/upload', name: 'upload', component: () => import('../views/UploadView.vue'), meta: { requiresAuth: true, minRole: 1 } },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true, minRole: 2 } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to) => {
  const user = useUserStore()
  if (to.meta.requiresAuth && !user.isLogin) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.minRole !== undefined && user.role < to.meta.minRole) {
    ElMessage.error('无权访问该页面')
    return { path: '/' }
  }
  return true
})

export default router
