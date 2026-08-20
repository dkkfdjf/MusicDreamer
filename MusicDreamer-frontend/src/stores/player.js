// 播放器 store：HTML5 Audio 单例 + 队列/模式/音量/进度状态
// 循环模式：0 顺序播放 1 单曲循环 2 列表循环 3 随机播放
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import api from '../api'
import { useUserStore } from './user'
import { resolveFileUrl, singerName } from '../utils'

let audioEl = null
let listenersBound = false

function fmtShort(t) {
  const s = Math.max(0, Math.floor(t || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function getAudio() {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.preload = 'auto'
  }
  return audioEl
}

export const PLAY_MODES = [
  { value: 0, label: '顺序播放' },
  { value: 1, label: '单曲循环' },
  { value: 2, label: '列表循环' },
  { value: 3, label: '随机播放' }
]

export const usePlayerStore = defineStore('player', {
  state: () => ({
    queue: [],
    currentIndex: -1,
    mode: 0,
    playing: false,
    loading: false,
    volume: Number(localStorage.getItem('md_volume') || 0.8), // 用户基准音量 0-1
    volumeGain: null, // 当前曲目响度补偿增益 dB（null 表示无）
    currentTime: 0,
    duration: 0,
    dragging: false, // 进度条拖拽中，暂停 timeupdate 回写
    rate: 1, // 播放倍速
    abA: null, // A-B 复读起点（秒）
    abB: null // A-B 复读终点（秒）
  }),
  getters: {
    current: (s) => s.queue[s.currentIndex] || null,
    currentSinger: (s) => singerName(s.queue[s.currentIndex]),
    modeLabel: (s) => (PLAY_MODES[s.mode] || PLAY_MODES[0]).label
  },
  actions: {
    // 绑定 audio 事件（App 挂载时调用一次）
    initAudio() {
      const a = getAudio()
      this.applyVolume()
      if (listenersBound) return
      listenersBound = true
      a.addEventListener('timeupdate', () => {
        if (!this.dragging) this.currentTime = a.currentTime || 0
        // A-B 复读：到达 B 点回到 A 点循环
        if (this.abA !== null && this.abB !== null && a.currentTime >= this.abB) {
          a.currentTime = this.abA
        }
      })
      a.addEventListener('durationchange', () => {
        this.duration = isFinite(a.duration) ? a.duration : 0
      })
      a.addEventListener('loadedmetadata', () => {
        if (isFinite(a.duration) && a.duration > 0) this.duration = a.duration
        a.playbackRate = this.rate // 换曲后保持倍速
      })
      a.addEventListener('play', () => {
        this.playing = true
      })
      a.addEventListener('playing', () => {
        this.playing = true
      })
      a.addEventListener('pause', () => {
        this.playing = false
      })
      a.addEventListener('ended', () => this.handleEnded())
      a.addEventListener('error', () => {
        if (this.current) {
          this.playing = false
          ElMessage.error('音频加载失败，请稍后重试')
        }
      })
    },
    // 响度补偿：audio.volume = 基准音量 * 10^(gain/20)，clamp 0-1；gain 为 null 时用基准音量
    applyVolume() {
      const a = getAudio()
      let v = this.volume
      const gain = Number(this.volumeGain)
      if (this.volumeGain !== null && this.volumeGain !== undefined && !Number.isNaN(gain)) {
        v = this.volume * Math.pow(10, gain / 20)
      }
      a.volume = Math.min(1, Math.max(0, v))
    },
    setVolume(v) {
      this.volume = Math.min(1, Math.max(0, v))
      localStorage.setItem('md_volume', String(this.volume))
      this.applyVolume()
    },
    async playAt(index) {
      if (index < 0 || index >= this.queue.length) return
      const song = this.queue[index]
      const a = getAudio()
      this.currentIndex = index
      this.currentTime = 0
      this.duration = Number(song.duration) || 0
      this.volumeGain = null
      this.loading = true
      try {
        const data = await api.songPlay(song.id)
        const url = data && (data.fileUrl || data.url)
        if (!url) {
          ElMessage.error('未获取到播放地址')
          return
        }
        if (data.volumeGain !== null && data.volumeGain !== undefined && data.volumeGain !== '') {
          this.volumeGain = Number(data.volumeGain)
        }
        a.src = resolveFileUrl(url)
        this.applyVolume()
        await a.play()
      } catch (e) {
        this.playing = false
      } finally {
        this.loading = false
      }
    },
    // 整队播放：点击某行时把当前列表作为队列
    playQueue(songs, index = 0) {
      const list = (songs || []).filter(Boolean)
      if (!list.length) return
      this.queue = list
      this.playAt(Math.min(Math.max(index, 0), list.length - 1))
    },
    playSong(song) {
      if (!song) return
      this.playQueue([song], 0)
    },
    toggle() {
      const a = getAudio()
      if (!this.current) {
        if (this.queue.length) this.playAt(0)
        return
      }
      if (a.paused) {
        a.play().catch(() => {})
      } else {
        a.pause()
      }
    },
    next(auto = false) {
      if (!this.queue.length) return
      if (this.mode === 3) {
        // 随机
        if (this.queue.length === 1) {
          if (!auto) this.playAt(this.currentIndex)
          return
        }
        let i = this.currentIndex
        while (i === this.currentIndex) {
          i = Math.floor(Math.random() * this.queue.length)
        }
        this.playAt(i)
        return
      }
      const nextIndex = this.currentIndex + 1
      if (nextIndex >= this.queue.length) {
        if (this.mode === 2 || !auto) {
          this.playAt(0) // 列表循环；或手动点击时回到开头
        } else {
          this.playing = false // 顺序模式播完最后一条停止
        }
        return
      }
      this.playAt(nextIndex)
    },
    prev() {
      if (!this.queue.length) return
      if (this.currentTime > 3) {
        // 播放超过 3 秒先回到开头
        this.seek(0)
        return
      }
      this.playAt((this.currentIndex - 1 + this.queue.length) % this.queue.length)
    },
    seek(t) {
      const a = getAudio()
      const time = Number(t)
      if (this.current && isFinite(time) && time >= 0) {
        a.currentTime = Math.min(time, a.duration || time)
        this.currentTime = time
      }
    },
    cycleMode() {
      this.mode = (this.mode + 1) % PLAY_MODES.length
      ElMessage({ message: this.modeLabel, grouping: true, duration: 1000 })
    },
    setRate(r) {
      this.rate = r
      getAudio().playbackRate = r
    },
    // A-B 复读：第一次点设 A，第二次点设 B 并开始循环，第三次清除
    cycleAb() {
      if (this.abA === null) {
        this.abA = this.currentTime
        ElMessage({ message: 'A 点已设置 ' + fmtShort(this.abA), grouping: true, duration: 1200 })
      } else if (this.abB === null) {
        if (this.currentTime <= this.abA) {
          ElMessage.warning('B 点需要晚于 A 点')
          return
        }
        this.abB = this.currentTime
        ElMessage({ message: 'A-B 复读开始', grouping: true, duration: 1200 })
      } else {
        this.clearAb()
        ElMessage({ message: '已清除 A-B 复读', grouping: true, duration: 1200 })
      }
    },
    clearAb() {
      this.abA = null
      this.abB = null
    },
    removeAt(index) {
      if (index < 0 || index >= this.queue.length) return
      const wasCurrent = index === this.currentIndex
      this.queue.splice(index, 1)
      if (index < this.currentIndex) {
        this.currentIndex -= 1
      } else if (wasCurrent) {
        // 移除的是当前曲：尝试播同位置下一首
        const a = getAudio()
        a.pause()
        if (index < this.queue.length) {
          this.playAt(index)
        } else if (this.queue.length) {
          this.playAt(this.queue.length - 1)
        } else {
          this.stop(true)
        }
      }
    },
    stop(keepQueue = false) {
      const a = getAudio()
      a.pause()
      if (!a.paused) a.currentTime = 0
      a.removeAttribute('src')
      this.playing = false
      this.currentIndex = -1
      this.currentTime = 0
      this.duration = 0
      this.volumeGain = null
      this.clearAb()
      if (!keepQueue) this.queue = []
    },
    async handleEnded() {
      const song = this.current
      const a = getAudio()
      const played = Math.round(a.currentTime || this.duration || 0)
      // 播完才上报：{ songId, playDuration }
      if (song) {
        const user = useUserStore()
        if (user.isLogin) {
          api.playReport({ songId: song.id, playDuration: played }).catch(() => {})
        }
      }
      if (this.mode === 1) {
        a.currentTime = 0
        a.play().catch(() => {})
        return
      }
      this.next(true)
    }
  }
})
