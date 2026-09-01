// 播放页：进度拖拽 / 三模式 / 上下曲 / 歌词滚动 / 收藏
import { player } from '../../services/player'
import { auth } from '../../services/auth'
import { api } from '../../services/api'
import { resolveUrl } from '../../config'
import { fmtDuration } from '../../utils/format'

const MODE_TEXT: Record<string, string> = { order: '顺序播放', single: '单曲循环', random: '随机播放' }

Page({
  data: {
    cur: null as any,
    playing: false,
    position: 0,
    duration: 0,
    posText: '0:00',
    durText: '--:--',
    mode: 'order',
    modeText: MODE_TEXT.order,
    lyrics: [] as any[],
    lyricIndex: -1,
    dragging: false,
    dragValue: 0,
    collected: false,
    cover: '',
    tab: 'cover' as 'cover' | 'lyric'
  },

  onLoad() {
    this._unsub = player.subscribe((s) => this.render(s))
    this.render(player.state)
    this._timer = setInterval(() => player.tick(), 500)
  },
  onUnload() {
    if (this._unsub) this._unsub()
    if (this._timer) clearInterval(this._timer)
  },

  render(s: any) {
    const patch: IAnyObject = {
      cur: s.cur,
      playing: s.playing,
      position: s.position,
      duration: s.duration,
      posText: fmtDuration(s.position),
      durText: fmtDuration(s.duration),
      mode: s.mode,
      modeText: MODE_TEXT[s.mode],
      lyrics: s.lyrics,
      lyricIndex: s.lyricIndex,
      cover: resolveUrl(s.cur && s.cur.coverUrl)
    }
    // 换歌时刷新收藏态
    if (s.cur && s.cur.id !== this._lastId) {
      this._lastId = s.cur.id
      this.refreshCollect(s.cur.id)
    }
    // 拖动中不受 tick 覆盖
    if (this.data.dragging) patch.position = this.data.dragValue
    this.setData(patch)
  },

  refreshCollect(songId: number) {
    if (!auth.isLoggedIn()) {
      this.setData({ collected: false })
      return
    }
    api.collectIds()
      .then((ids: number[]) => {
        this.setData({ collected: ids.indexOf(songId) >= 0 })
      })
      .catch(() => {})
  },

  onToggle() {
    player.toggle()
  },
  onNext() {
    player.next()
  },
  onPrev() {
    player.prev()
  },
  onMode() {
    player.setMode()
  },

  onDragging(e: any) {
    // 首次触发即视为拖动开始（slider 无 changestart 事件）
    if (!this.data.dragging) this.setData({ dragging: true })
    this.setData({ dragValue: e.detail.value, posText: fmtDuration(e.detail.value) })
  },
  onDragEnd(e: any) {
    player.seek(e.detail.value)
    this.setData({ dragging: false, position: e.detail.value })
  },

  onCollect() {
    if (!auth.requireLoginTip() || !this.data.cur) return
    const id = this.data.cur.id
    if (this.data.collected) {
      api.collectRemove(id)
        .then(() => {
          this.setData({ collected: false })
          wx.showToast({ title: '已取消收藏', icon: 'none' })
        })
        .catch(() => {})
    } else {
      api.collectAdd(id)
        .then(() => {
          this.setData({ collected: true })
          wx.showToast({ title: '已收藏', icon: 'none' })
        })
        .catch(() => {})
    }
  },

  switchTab(e: any) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
