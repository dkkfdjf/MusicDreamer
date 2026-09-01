// 歌曲行：点击=整列表入队播放；心形=收藏；…=加入歌单（页面处理）
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { api } from '../../services/api'
import { fmtDuration } from '../../utils/format'

Component({
  properties: {
    song: { type: Object, value: null },
    index: { type: Number, value: 0 },
    playing: { type: Boolean, value: false },
    showCollect: { type: Boolean, value: true },
    list: { type: Array, value: [] }
  },
  data: { durText: '', collected: false },
  observers: {
    song(s: any) {
      if (!s) return
      this.setData({ durText: fmtDuration(s.duration) })
      if (auth.isLoggedIn()) {
        // collectIds 带模块级 30s 缓存，列表行并发调用不会请求风暴
        api.collectIds()
          .then((ids: number[]) => {
            this.setData({ collected: ids.indexOf(s.id) >= 0 })
          })
          .catch(() => {})
      }
    }
  },
  methods: {
    onTap() {
      player.playQueue(this.data.list, this.data.index)
    },
    onCollect() {
      if (!auth.requireLoginTip()) return
      const s = this.data.song
      if (this.data.collected) {
        api.collectRemove(s.id)
          .then(() => {
            this.setData({ collected: false })
            wx.showToast({ title: '已取消收藏', icon: 'none' })
          })
          .catch(() => {})
      } else {
        api.collectAdd(s.id)
          .then(() => {
            this.setData({ collected: true })
            wx.showToast({ title: '已收藏', icon: 'none' })
          })
          .catch(() => {})
      }
    },
    onMore() {
      this.triggerEvent('more', { song: this.data.song })
    }
  }
})
