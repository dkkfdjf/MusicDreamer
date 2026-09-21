// 统一请求层：Promise 化 wx.request；code===0 解包 data；2006/401 清登录态回登录页
import { BASE_URL, resolveUrlsDeep } from '../config'
import { auth } from './auth'

// ---------- 数据类型（与后端 VO 一一对应） ----------
export interface SongCardVO {
  id: number
  name: string
  singer: string
  singerId: number
  album: string
  style: string
  duration: number
  coverUrl: string
  playCount: number
  weekPlayCount: number
  score: number
}
export interface SongPlayVO {
  songId: number
  name: string
  singer: string
  singerId: number
  album: string
  fileUrl: string
  coverUrl: string
  lyricUrl: string
  duration: number
  volumeGain: number
  fileFormat: string
}
export interface RecentVO {
  songId: number
  name: string
  singer: string
  album: string
  coverUrl: string
  duration: number
  lastPlayedAt: string
}
export interface PlaylistVO {
  id: number
  userId: number
  name: string
  description: string
  coverUrl: string
  isPublic: boolean
  createTime: string
  songCount: number
  favoriteTime: string
  creatorName: string
}
export interface PlaylistSongVO {
  songId: number
  name: string
  singerName: string
  singerId: number
  coverUrl: string
  duration: number
  style: string
  album: string
  status: number
}
export interface PlaylistDetailVO {
  id: number
  userId: number
  name: string
  description: string
  coverUrl: string
  isPublic: boolean
  createTime: string
  updateTime: string
  songCount: number
  favored: boolean
  songs: PlaylistSongVO[]
  creatorName: string
  singerName?: string // 专辑详情时有
}
export interface CollectItemVO {
  songId: number
  name: string
  singerName: string
  singerId: number
  coverUrl: string
  duration: number
  style: string
  album: string
  status: number
}
export interface PageResult<T> {
  total: number
  records: T[]
}

interface RawRes {
  code: number
  message: string
  data: any
}

function request(method: string, path: string, data?: any, silent = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const header: IAnyObject = { 'content-type': 'application/json' }
    const tk = auth.getToken()
    if (tk) header.Authorization = 'Bearer ' + tk
    wx.request({
      url: BASE_URL + path,
      method: method as any,
      data,
      header,
      timeout: 15000,
      success: (res: any) => {
        const body = res.data as RawRes
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0) return resolve(resolveUrlsDeep(body.data))
          // 登录过期：清态回登录页（silent 请求不弹提示，避免连环 toast）
          if (body.code === 2006) {
            auth.clear()
            if (!silent) wx.showToast({ title: '登录已过期', icon: 'none' })
            wx.reLaunch({ url: '/pages/login/login' })
            return reject(new Error(body.message || '登录已过期'))
          }
          if (!silent) wx.showToast({ title: body.message || '请求失败', icon: 'none' })
          return reject(new Error(body.message || '请求失败'))
        }
        // 网关直接拒绝（无统一外层）
        if (res.statusCode === 401) {
          auth.clear()
          wx.reLaunch({ url: '/pages/login/login' })
          return reject(new Error('登录已过期'))
        }
        if (!silent) wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
        reject(new Error('HTTP ' + res.statusCode))
      },
      fail: (err: any) => {
        if (!silent) wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
        reject(new Error(err && err.errMsg))
      }
    })
  })
}

const get = (path: string, params?: IAnyObject, silent = false) => {
  const qs = params
    ? '?' +
      Object.keys(params)
        .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .map((k) => k + '=' + encodeURIComponent(params[k]))
        .join('&')
    : ''
  return request('GET', path + qs, undefined, silent)
}
const post = (path: string, data?: any) => request('POST', path, data || {})
const put = (path: string, data?: any) => request('PUT', path, data || {})
const del = (path: string) => request('DELETE', path)

// ---------- collectIds 模块级 30s 缓存（列表行逐行查询时避免请求风暴） ----------
let idsCache: { t: number; ids: number[] } | null = null

export const api = {
  // ---------- 账号（匿名白名单接口） ----------
  register: (d: { username: string; nickname: string; email: string; password: string }) =>
    post('/user/register', d),
  login: (d: { username: string; password: string; remember?: boolean }) => post('/user/login', d),
  resetPassword: (d: { username: string; email: string; newPassword: string }) =>
    post('/user/password/reset', d),
  logout: () => post('/user/logout'),
  userInfo: () => get('/user/info'),
  // ---------- 歌曲/搜索/推荐（匿名） ----------
  songChart: (type: 'hot' | 'rise', limit = 20) => get('/song/chart', { type, limit }),
  songPlay: (id: number) => get(`/song/play/${id}`),
  songDetail: (id: number) => get(`/song/detail/${id}`),
  searchSongs: (keyword: string, page = 1, size = 20) => get('/search/songs', { keyword, page, size }),
  searchStyles: () => get('/search/styles'),
  searchByStyle: (params: { style?: string; language?: string; page?: number; size?: number }) =>
    get('/search/by-style', params),
  recommendList: (limit = 10) => get('/recommend/list', { limit }),
  // ---------- 播放记录（需登录） ----------
  playReport: (songId: number, playDuration: number) =>
    post('/music/playReport', { songId, playDuration }),
  recentPlays: (limit = 20) => get('/music/recent', { limit }),
  playHistory: (page = 1, size = 20) => get('/music/history', { page, size }),
  // ---------- 歌单 ----------
  publicPlaylists: (params: { page?: number; size?: number; keyword?: string }) =>
    get('/playlist/public/list', params),
  playlistDetail: (id: number, silent = false) => get(`/playlist/${id}`, undefined, silent),
  myPlaylists: () => get('/playlist/my'),
  createPlaylist: (d: { name: string; description?: string; isPublic?: boolean }) =>
    post('/playlist/create', d),
  updatePlaylist: (id: number, d: { name?: string; description?: string; isPublic?: boolean }) =>
    put(`/playlist/update/${id}`, d),
  deletePlaylist: (id: number) => del(`/playlist/${id}`),
  addPlaylistSong: (id: number, songId: number) => post(`/playlist/${id}/songs`, { songId }),
  removePlaylistSong: (id: number, songId: number) => del(`/playlist/${id}/songs/${songId}`),
  favPlaylist: (id: number) => post(`/playlist/${id}/favorite`),
  unfavPlaylist: (id: number) => del(`/playlist/${id}/favorite`),
  // ---------- 专辑（与歌单同构；加/删歌与收藏路径镜像前端 api/index.js） ----------
  publicAlbums: (params: { page?: number; size?: number; keyword?: string }) =>
    get('/album/public/list', params),
  albumDetail: (id: number, silent = false) => get(`/album/${id}`, undefined, silent),
  albumAddSong: (id: number, songId: number) => post(`/album/${id}/song/${songId}`),
  albumRemoveSong: (id: number, songId: number) => del(`/album/${id}/song/${songId}`),
  albumFav: (id: number) => post(`/album/${id}/favorite`),
  albumUnfav: (id: number) => del(`/album/${id}/favorite`),
  // ---------- 收藏歌曲（需登录；ids 走 30s 缓存，增删后失效） ----------
  collectAdd: (songId: number) => {
    idsCache = null
    return post('/collect/add', { songId })
  },
  collectRemove: (songId: number) => {
    idsCache = null
    return del(`/collect/${songId}`)
  },
  collectList: (page = 1, size = 20) => get('/collect/list', { page, size }),
  collectIds: (): Promise<number[]> => {
    if (idsCache && Date.now() - idsCache.t < 30000) return Promise.resolve(idsCache.ids)
    return get('/collect/ids', undefined, true).then((ids: number[]) => {
      idsCache = { t: Date.now(), ids: ids || [] }
      return idsCache.ids
    })
  }
}

export default api
