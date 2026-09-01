// 全局迷你播放条：订阅 player 状态；点主体进播放页；右下两个控制按钮
import { player } from '../../services/player'
import { resolveUrl } from '../../config'

Component({
  data: { cur: null as any, playing: false, cover: '' },
  lifetimes: {
    attached() {
      this._unsub = player.subscribe((s) => {
        this.setData({ cur: s.cur, playing: s.playing, cover: resolveUrl(s.cur && s.cur.coverUrl) })
      })
      this._timer = setInterval(() => player.tick(), 500)
    },
    detached() {
      if (this._unsub) this._unsub()
      if (this._timer) clearInterval(this._timer)
    }
  },
  methods: {
    openPlaying() {
      wx.navigateTo({ url: '/pages/playing/playing' })
    },
    onToggle() {
      player.toggle()
    },
    onNext() {
      player.next()
    }
  }
})
