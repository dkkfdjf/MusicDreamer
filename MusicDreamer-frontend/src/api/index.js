// 统一 API 封装：axios 实例 + 拦截器 + 全部后端接口
// 响应统一 { code, message, data, timestamp }，code=0 成功；拦截器直接返回 data
import axios from 'axios'
import { ElMessage } from 'element-plus'

const BASE = '/api/v1'
export const TOKEN_KEY = 'md_token'
export const USER_KEY = 'md_user'

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function redirectToLogin() {
  // 使用整页跳转而非 router，避免 api <-> router 循环依赖；整页刷新后 store 会从 localStorage 重建
  if (window.location.pathname !== '/login') {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = '/login?redirect=' + redirect
  }
}

const request = axios.create({
  baseURL: '/',
  timeout: 30000
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      ElMessage.error(body.message || '请求失败')
      if (body.code === 2006) {
        clearAuth()
        redirectToLogin()
      }
      return Promise.reject(new Error(body.message || `请求失败(code=${body.code})`))
    }
    return body
  },
  (err) => {
    const resp = err && err.response
    const body = resp && resp.data
    const msg = (body && body.message) || (err && err.message) || '网络错误，请稍后重试'
    const code = body && typeof body === 'object' ? body.code : undefined
    ElMessage.error(msg)
    if ((resp && resp.status === 401) || code === 2006) {
      clearAuth()
      redirectToLogin()
    }
    return Promise.reject(err instanceof Error ? err : new Error(msg))
  }
)

function post(path, data, config) {
  return request.post(BASE + path, data, config)
}
function get(path, params, config) {
  return request.get(BASE + path, { params, ...config })
}
function put(path, data, config) {
  return request.put(BASE + path, data, config)
}
function del(path, params, config) {
  return request.delete(BASE + path, { params, ...config })
}

export const api = {
  // ---------- 用户 ----------
  register: (data) => post('/user/register', data),
  activate: (token) => get('/user/activate', { token }),
  login: (data) => post('/user/login', data),
  logout: () => post('/user/logout'),
  sendResetCode: (email) => post('/user/password/send-code', { email }),
  resetPassword: (data) => post('/user/password/reset', data),
  getUserInfo: () => get('/user/info'),
  updateUserInfo: (data) => put('/user/info', data),

  // ---------- 歌手认证 ----------
  singerApply: (data) => post('/user/singer/apply', data),
  singerAudit: (data) => post('/user/singer/audit', data),
  singerApplications: (params) => get('/user/singer/applications', params),

  // ---------- 用户管理（管理员） ----------
  userList: (params) => get('/user/list', params),
  setUserStatus: (data) => post('/user/status', data),

  // ---------- 歌曲 ----------
  songSubmit: (data) => post('/song/submit', data),
  songPlay: (id) => get(`/song/play/${id}`),
  songDetail: (id) => get(`/song/detail/${id}`),
  songChart: (params) => get('/song/chart', params),
  songEdit: (id, data) => put(`/song/edit/${id}`, data),
  songResubmit: (id) => post(`/song/resubmit/${id}`),
  songMine: (params) => get('/song/mine', params),
  songAdminList: (params) => get('/song/admin/list', params),
  songAudit: (data) => post('/song/audit', data),
  songTakedown: (id, reason) => post(`/song/takedown/${id}`, { reason }),
  songRelist: (id) => post(`/song/relist/${id}`),

  // ---------- 上传 ----------
  uploadAudio: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return post('/upload/audio', fd, { timeout: 120000 })
  },
  uploadImage: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return post('/upload/image', fd, { timeout: 120000 })
  },

  // ---------- 搜索 ----------
  searchSongs: (params) => get('/search/songs', params),
  searchSingers: (params) => get('/search/singers', params),
  searchByStyle: (params) => get('/search/by-style', params),

  // ---------- 播放 ----------
  playReport: (data) => post('/music/playReport', data),
  recentPlays: (limit = 10) => get('/music/recent', { limit }),
  playHistory: (params) => get('/music/history', params),

  // ---------- 推荐 ----------
  recommendList: (limit = 10) => get('/recommend/list', { limit }),

  // ---------- 歌单 ----------
  myPlaylists: () => get('/playlist/my'),
  createPlaylist: (data) => post('/playlist/create', data),
  updatePlaylist: (id, data) => put(`/playlist/update/${id}`, data),
  deletePlaylist: (id) => del(`/playlist/${id}`),
  addPlaylistSong: (id, songId) => post(`/playlist/${id}/songs`, { songId }),
  removePlaylistSong: (id, songId) => del(`/playlist/${id}/songs/${songId}`),
  getPlaylist: (id) => get(`/playlist/${id}`),
  favoritePlaylist: (id) => post(`/playlist/${id}/favorite`),
  unfavoritePlaylist: (id) => del(`/playlist/${id}/favorite`),
  publicPlaylists: (params) => get('/playlist/public/list', params),

  // ---------- 收藏 ----------
  collectAdd: (songId) => post('/collect/add', { songId }),
  collectRemove: (songId) => del(`/collect/${songId}`),
  collectList: (params) => get('/collect/list', params),
  collectIds: () => get('/collect/ids'),

  // ---------- 评论 ----------
  commentList: (songId, params) => get(`/comment/list/${songId}`, params),
  addComment: (data) => post('/comment/add', data),
  deleteComment: (id) => del(`/comment/${id}`),
  likeComment: (id) => post(`/comment/${id}/like`),
  unlikeComment: (id) => del(`/comment/${id}/like`),

  // ---------- 举报 ----------
  reportSubmit: (data) => post('/report/submit', data),
  reportList: (params) => get('/report/list', params),
  reportHandle: (data) => post('/report/handle', data),

  // ---------- 媒体任务 ----------
  mediaDownload: (data) => post('/media/download', data),
  mediaTask: (id) => get(`/media/task/${id}`),
  mediaCancel: (id) => post(`/media/task/${id}/cancel`),
  mediaTranscribe: (songId) => post(`/media/transcribe/${songId}`),
  mediaLoudness: (songId) => post(`/media/loudness/${songId}`),

  // ---------- 媒体工具/模型（管理员） ----------
  toolsStatus: () => get('/media/tools/status'),
  updateYtdlp: () => post('/media/tools/update-ytdlp'),
  models: () => get('/media/models'),
  modelDownload: (key) => post(`/media/models/${key}/download`),
  modelUse: (key) => post(`/media/models/${key}/use`),
  modelDelete: (key) => post(`/media/models/${key}/delete`),

  // ---------- 配置 / 公告 ----------
  settingAll: () => get('/setting/all'),
  settingSet: (key, value) => post(`/setting/set/${key}`, { value }),
  announcementList: () => get('/announcement/list')
}

export default api
