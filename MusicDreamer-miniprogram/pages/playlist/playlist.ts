// 歌单/专辑共用详情：头部信息 + 播放全部 + 收藏 + 主人管理（加歌/删歌/删除）
import { api } from '../../services/api'
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { pickPlaylist } from '../../utils/playlistPicker'

Page({
  data: {
    type: 'playlist' as 'playlist' | 'album',
    id: 0,
    detail: null as any,
    isOwner: false,
    songs: [] as any[], // 已映射为 song-item 可用形态 {id,name,singer,duration,coverUrl,album}
    curId: 0,
    // 加歌弹层
    addShow: false,
    addKw: '',
    addResults: [] as any[],
    adding: false
  },

  onLoad(options: any) {
    this.setData({ id: Number(options.id) || 0, type: options.type === 'album' ? 'album' : 'playlist' })
    this._unsub = player.subscribe((s) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
  },
  onUnload() {
    if (this._unsub) this._unsub()
  },
  onShow() {
    this.load()
  },

  async load() {
    try {
      const d =
        this.data.type === 'album' ? await api.albumDetail(this.data.id) : await api.playlistDetail(this.data.id)
      const me = auth.get()
      const isOwner = !!(me && d && me.user.id === d.userId)
      const songs = ((d && d.songs) || []).map((s: any) => ({
        id: s.songId,
        name: s.name,
        singer: s.singerName,
        album: s.album,
        style: s.style,
        duration: s.duration,
        coverUrl: s.coverUrl
      }))
      this.setData({ detail: d, isOwner, songs })
      if (d && d.name) wx.setNavigationBarTitle({ title: '悦享音乐 · ' + d.name })
    } catch (e) {
      // api 层已提示（私有歌单无权限等）
    }
  },

  playAll() {
    if (!this.data.songs.length) {
      wx.showToast({ title: '还没有歌曲', icon: 'none' })
      return
    }
    player.playQueue(this.data.songs, 0)
  },

  async toggleFav() {
    if (!auth.requireLoginTip() || !this.data.detail) return
    const d = this.data.detail
    const isAlbum = this.data.type === 'album'
    try {
      if (d.favored) {
        await (isAlbum ? api.albumUnfav(d.id) : api.unfavPlaylist(d.id))
        wx.showToast({ title: '已取消收藏', icon: 'none' })
        this.setData({ 'detail.favored': false } as any)
      } else {
        await (isAlbum ? api.albumFav(d.id) : api.favPlaylist(d.id))
        wx.showToast({ title: isAlbum ? '已收藏专辑' : '已收藏歌单', icon: 'none' })
        this.setData({ 'detail.favored': true } as any)
      }
    } catch (e) {
      /* api 层已提示 */
    }
  },

  onSongMore(e: any) {
    if (!auth.requireLoginTip()) return
    pickPlaylist(e.detail.song)
  },

  removeSong(e: any) {
    if (!this.data.isOwner) return
    const songId = e.currentTarget.dataset.id
    const isAlbum = this.data.type === 'album'
    const that = this
    wx.showModal({
      title: '从' + (isAlbum ? '专辑' : '歌单') + '移除',
      content: '确定移除这首歌曲吗？',
      success: async (res: any) => {
        if (!res.confirm) return
        try {
          await (isAlbum ? api.albumRemoveSong(that.data.id, songId) : api.removePlaylistSong(that.data.id, songId))
          wx.showToast({ title: '已移除', icon: 'none' })
          that.load()
        } catch (e) {
          /* api 层已提示 */
        }
      }
    })
  },

  removeList() {
    if (!this.data.isOwner) return
    const that = this
    wx.showModal({
      title: '删除确认',
      content: '删除后不可恢复，确定删除整个' + (this.data.type === 'album' ? '专辑' : '歌单') + '吗？',
      success: async (res: any) => {
        if (!res.confirm) return
        try {
          await api.deletePlaylist(that.data.id)
          wx.showToast({ title: '已删除', icon: 'none' })
          setTimeout(() => wx.navigateBack(), 600)
        } catch (e) {
          /* api 层已提示 */
        }
      }
    })
  },

  // ---------- 半屏加歌弹层 ----------
  openAdd() {
    if (!auth.requireLoginTip()) return
    this.setData({ addShow: true, addKw: '', addResults: [] })
  },
  closeAdd() {
    this.setData({ addShow: false })
  },
  noop() {}, // 挡住弹层主体的冒泡关闭
  onAddKw(e: any) {
    this.setData({ addKw: e.detail.value })
  },
  async doAddSearch() {
    const kw = this.data.addKw.trim()
    if (!kw) return
    try {
      const res = await api.searchSongs(kw, 1, 20)
      this.setData({ addResults: res.songs || [] })
    } catch (e) {
      /* api 层已提示 */
    }
  },
  async addSong(e: any) {
    if (this.data.adding) return
    const song = e.currentTarget.dataset.song
    const isAlbum = this.data.type === 'album'
    this.setData({ adding: true })
    try {
      await (isAlbum ? api.albumAddSong(this.data.id, song.id) : api.addPlaylistSong(this.data.id, song.id))
      wx.showToast({ title: '已添加', icon: 'none' })
      this.setData({ adding: false })
      this.load()
    } catch (e) {
      this.setData({ adding: false })
    }
  }
})
