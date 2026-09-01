// 首页：推荐 + 热歌榜 + 飙升榜；匿名可看，收藏/加歌需登录
import { api, SongCardVO } from '../../services/api'
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { pickPlaylist } from '../../utils/playlistPicker'

interface Section {
  key: string
  title: string
  desc: string
  songs: SongCardVO[]
}

Page({
  data: { sections: [] as Section[], loading: true, curId: 0, loggedIn: false },

  onLoad() {
    this._unsub = player.subscribe((s) => {
      this.setData({ curId: (s.cur && s.cur.id) || 0 })
    })
  },
  onUnload() {
    if (this._unsub) this._unsub()
  },
  onShow() {
    this.setData({ loggedIn: auth.isLoggedIn() })
    this.load()
  },
  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  async load() {
    try {
      const [rec, hot, rise] = await Promise.all([
        api.recommendList(10).catch(() => []),
        api.songChart('hot', 10),
        api.songChart('rise', 10)
      ])
      const sections: Section[] = [
        { key: 'rec', title: '为你推荐', desc: '按你的口味挑选', songs: rec || [] },
        { key: 'hot', title: '热歌榜', desc: '大家都在听', songs: hot || [] },
        { key: 'rise', title: '飙升榜', desc: '近 7 天上升最快', songs: rise || [] }
      ]
      this.setData({ sections, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onMore(e: any) {
    // 加入歌单（通用工具，登录校验内含）
    if (!auth.requireLoginTip()) return
    pickPlaylist(e.detail.song)
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  }
})
