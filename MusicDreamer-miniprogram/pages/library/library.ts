// 音乐库三段：收藏歌曲 / 我的歌单(创建+收藏) / 最近播放
import { api, PlaylistVO, RecentVO } from '../../services/api'
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { fmtDuration } from '../../utils/format'
import { pickPlaylist } from '../../utils/playlistPicker'

Page({
  data: {
    tab: 'songs' as 'songs' | 'playlists' | 'recent',
    loggedIn: false,
    collects: [] as any[],
    created: [] as PlaylistVO[],
    favorited: [] as PlaylistVO[],
    recents: [] as any[],
    curId: 0
  },

  onLoad() {
    this._unsub = player.subscribe((s) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
  },
  onUnload() {
    if (this._unsub) this._unsub()
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) return
    if (this.data.tab === 'songs') this.loadCollects()
    else if (this.data.tab === 'recent') this.loadRecents()
    else this.loadPlaylists()
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    if (!auth.isLoggedIn()) return auth.requireLoginTip()
    if (tab === 'songs') this.loadCollects()
    else if (tab === 'recent') this.loadRecents()
    else this.loadPlaylists()
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async loadCollects() {
    try {
      const res = await api.collectList(1, 100)
      const collects = ((res && res.records) || []).map((c: any) => ({
        id: c.songId,
        name: c.name,
        singer: c.singerName,
        album: c.album,
        style: c.style,
        duration: c.duration,
        coverUrl: c.coverUrl
      }))
      this.setData({ collects })
    } catch (e) {
      /* api 层已提示 */
    }
  },

  async loadPlaylists() {
    try {
      const my = await api.myPlaylists()
      this.setData({ created: (my && my.created) || [], favorited: (my && my.favorited) || [] })
    } catch (e) {
      /* api 层已提示 */
    }
  },

  async loadRecents() {
    try {
      const recents = await api.recentPlays(20)
      this.setData({
        recents: (recents || []).map((r: RecentVO) => ({ ...r, durText: fmtDuration(r.duration) }))
      })
    } catch (e) {
      /* api 层已提示 */
    }
  },

  playRecent(e: any) {
    const index = e.currentTarget.dataset.index
    player.playQueue(this.data.recents, index)
  },

  onCreatePlaylist() {
    if (!auth.requireLoginTip()) return
    const that = this
    wx.showModal({
      title: '新建歌单',
      editable: true,
      placeholderText: '歌单名称',
      success: async (res: any) => {
        if (!res.confirm || !res.content || !res.content.trim()) return
        try {
          await api.createPlaylist({ name: res.content.trim(), isPublic: true })
          wx.showToast({ title: '已创建', icon: 'none' })
          that.loadPlaylists()
        } catch (e) {
          /* api 层已提示 */
        }
      }
    })
  },

  onPlaylistTap(e: any) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/playlist/playlist?id=${id}&type=${type}` })
  },

  deletePlaylist(e: any) {
    const id = e.currentTarget.dataset.id
    const that = this
    wx.showModal({
      title: '删除歌单',
      content: '确定删除这个歌单吗？',
      success: async (res: any) => {
        if (!res.confirm) return
        try {
          await api.deletePlaylist(id)
          wx.showToast({ title: '已删除', icon: 'none' })
          that.loadPlaylists()
        } catch (e) {
          /* api 层已提示 */
        }
      }
    })
  },

  onSongMore(e: any) {
    if (!auth.requireLoginTip()) return
    pickPlaylist(e.detail.song)
  }
})
