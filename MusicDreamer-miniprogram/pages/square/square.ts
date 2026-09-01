// 广场三段：歌曲（搜索+曲风）/ 歌单广场 / 专辑广场
import { api, SongCardVO, PlaylistVO } from '../../services/api'
import { player } from '../../services/player'
import { pickPlaylist } from '../../utils/playlistPicker'
import { auth } from '../../services/auth'

Page({
  data: {
    tab: 'songs' as 'songs' | 'playlists' | 'albums',
    keyword: '',
    styles: [] as string[],
    curStyle: '',
    songs: [] as SongCardVO[],
    songTotal: 0,
    page: 1,
    lists: [] as PlaylistVO[],
    listTotal: 0,
    loading: false,
    curId: 0
  },

  onLoad() {
    this._unsub = player.subscribe((s: any) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
    api.searchStyles()
      .then((styles: string[]) => this.setData({ styles: styles || [] }))
      .catch(() => {})
  },
  onUnload() {
    if (this._unsub) this._unsub()
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'songs') this.reloadSongs()
    else this.loadLists(tab, true)
  },

  onKeyword(e: any) {
    this.setData({ keyword: e.detail.value })
  },
  onSearch() {
    this.reloadSongs()
  },
  pickStyle(e: any) {
    const style = e.currentTarget.dataset.style
    // 再点一次取消筛选
    this.setData({ curStyle: this.data.curStyle === style ? '' : style })
    this.reloadSongs()
  },

  async loadSongs() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const kw = this.data.keyword.trim()
      const res = kw
        ? await api.searchSongs(kw, this.data.page, 20)
        : await api.searchByStyle({ style: this.data.curStyle, page: this.data.page, size: 20 })
      const songs = this.data.songs.concat(res.songs || [])
      this.setData({ songs, songTotal: res.total || 0, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
  reloadSongs() {
    this.setData({ page: 1, songs: [], songTotal: 0 })
    this.loadSongs()
  },
  onReachBottom() {
    if (this.data.tab !== 'songs' || this.data.loading) return
    if (this.data.songs.length >= this.data.songTotal) return
    this.setData({ page: this.data.page + 1 })
    this.loadSongs()
  },

  async loadLists(kind: 'playlists' | 'albums', reset: boolean) {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const fn = kind === 'playlists' ? api.publicPlaylists : api.publicAlbums
      const res = await fn({ page: 1, size: 20, keyword: this.data.keyword.trim() })
      this.setData({ lists: res.records || [], listTotal: res.total || 0, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onPlayMore(e: any) {
    if (!auth.requireLoginTip()) return
    pickPlaylist(e.detail.song)
  },
  onListTap(e: any) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/playlist/playlist?id=${id}&type=${type}` })
  }
})
