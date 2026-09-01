// 全局播放器单例：BackgroundAudioManager + 队列/模式/上报/歌词，页面通过 subscribe 订阅状态
import { api, SongCardVO } from './api'
import { createStore } from './store'
import { resolveUrl } from '../config'
import { parseLrc, findLrcIndex, LrcLine } from './lrc'

export type PlayMode = 'order' | 'single' | 'random'

interface PlayerState {
  cur: SongCardVO | null
  playing: boolean
  position: number
  duration: number
  mode: PlayMode
  lyrics: LrcLine[]
  lyricIndex: number
}

/** 队列元素统一成 SongCardVO 形态（不同来源字段名不同：songId→id、singerName→singer） */
function normalize(s: any): SongCardVO {
  return {
    id: s.id != null ? s.id : s.songId,
    name: s.name || s.songName || '',
    singer: s.singer || s.singerName || '',
    singerId: s.singerId || 0,
    album: s.album || '',
    style: s.style || '',
    duration: s.duration || 0,
    coverUrl: s.coverUrl || '',
    playCount: s.playCount || 0,
    weekPlayCount: 0,
    score: 0
  }
}

const REPORT_AFTER_SEC = 30 // 播满 30 秒或过半上报一次

class Player {
  private store = createStore<PlayerState>({
    cur: null,
    playing: false,
    position: 0,
    duration: 0,
    mode: 'order',
    lyrics: [],
    lyricIndex: -1
  })
  private queue: SongCardVO[] = []
  private index = -1
  private audio = wx.getBackgroundAudioManager()
  private playSeq = 0 // 代际号：慢响应换歌时丢弃旧请求
  private reported = false
  private startAt = 0 // 当前曲开始播放时的 Date.now()
  private lastTick = 0 // onTimeUpdate 节流

  constructor() {
    const a = this.audio
    a.onPlay(() => this.store.set({ playing: true }))
    a.onPause(() => this.store.set({ playing: false }))
    a.onStop(() => this.store.set({ playing: false }))
    a.onEnded(() => {
      this.flushReport()
      if (this.store.get().mode === 'single') this.replay()
      else this.next()
    })
    a.onNext(() => this.next()) // 系统播放器上一首/下一首
    a.onPrev(() => this.prev())
    a.onError((err: any) => {
      console.error('bgAudio error', err)
      this.store.set({ playing: false })
      wx.showToast({ title: '播放失败，已跳过', icon: 'none' })
      this.next()
    })
  }

  subscribe(fn: (s: PlayerState) => void): () => void {
    return this.store.subscribe(fn)
  }

  get state(): PlayerState {
    return this.store.get()
  }

  /** 整列表入队并播放 index（队列存统一形态） */
  playQueue(songs: any[], index: number): void {
    if (!songs || !songs.length) return
    this.queue = songs.map(normalize)
    this.playAt(index < 0 || index >= this.queue.length ? 0 : index)
  }

  toggle(): void {
    if (!this.store.get().cur) {
      if (this.queue.length) this.playAt(0)
      return
    }
    if (this.store.get().playing) this.audio.pause()
    else this.audio.play()
  }

  next(): void {
    if (!this.queue.length) return
    const mode = this.store.get().mode
    let i: number
    if (mode === 'random') {
      i = this.queue.length === 1 ? this.index : Math.floor(Math.random() * this.queue.length)
    } else {
      i = (this.index + 1) % this.queue.length // order：到队尾回第一首（列表语义）
    }
    this.playAt(i)
  }

  prev(): void {
    if (!this.queue.length) return
    const mode = this.store.get().mode
    let i: number
    if (mode === 'random') {
      i = this.queue.length === 1 ? this.index : Math.floor(Math.random() * this.queue.length)
    } else {
      i = (this.index - 1 + this.queue.length) % this.queue.length
    }
    this.playAt(i)
  }

  seek(sec: number): void {
    this.audio.seek(sec)
    this.store.set({ position: sec })
  }

  setMode(): void {
    const order: PlayMode[] = ['order', 'single', 'random']
    const cur = this.store.get().mode
    const next = order[(order.indexOf(cur) + 1) % order.length]
    this.store.set({ mode: next })
  }

  // ---------- 内部 ----------

  private async playAt(i: number): Promise<void> {
    this.flushReport() // 上一首补报
    this.index = i
    const song = this.queue[i]
    const seq = ++this.playSeq
    this.store.set({
      cur: song,
      playing: false,
      position: 0,
      duration: song.duration || 0,
      lyrics: [],
      lyricIndex: -1
    })
    let vo: any
    try {
      vo = await api.songPlay(song.id)
    } catch (e) {
      return // toast 已由 api 层弹过
    }
    if (seq !== this.playSeq) return // 用户已切下一首，丢弃
    this.reported = false
    this.startAt = Date.now()
    // title 必须在 src 之前赋值（iOS 后台播放要求）
    this.audio.title = song.name || vo.name || '未知歌曲'
    this.audio.singer = vo.singer || song.singer || ''
    this.audio.epname = vo.album || ''
    this.audio.coverUrl = resolveUrl(vo.coverUrl || song.coverUrl)
    this.audio.src = resolveUrl(vo.fileUrl) // 赋 src 即开播
    this.store.set({ playing: true, duration: vo.duration || song.duration || 0 })
    // 歌词：lyricUrl 存在则下载解析
    if (vo.lyricUrl) {
      wx.request({
        url: resolveUrl(vo.lyricUrl),
        method: 'GET',
        responseType: 'text',
        success: (res: any) => {
          if (seq !== this.playSeq) return
          const text = typeof res.data === 'string' ? res.data : ''
          this.store.set({ lyrics: parseLrc(text), lyricIndex: -1 })
        },
        fail: () => {}
      })
    }
  }

  private replay(): void {
    if (this.index >= 0) this.playAt(this.index)
  }

  /** 播满 30s 或过半上报一次；切歌时补报 */
  private flushReport(): void {
    const cur = this.store.get().cur
    if (!cur || this.reported) return
    const played = Math.floor((Date.now() - this.startAt) / 1000)
    const dur = this.store.get().duration || 0
    if (played >= REPORT_AFTER_SEC || (dur > 0 && played >= dur / 2)) {
      this.reported = true
      api.playReport(cur.id, played).catch(() => {})
    }
  }

  /** 页面/迷你条每 500ms 调一次：从 bgAudioManager 拉进度并更新歌词行 */
  tick(): void {
    const now = Date.now()
    if (now - this.lastTick < 450) return
    this.lastTick = now
    const a = this.audio
    const position = a.currentTime || 0
    const duration = a.duration || this.store.get().duration
    const st: Partial<PlayerState> = { position, duration }
    const lyrics = this.store.get().lyrics
    if (lyrics.length) {
      const lyricIndex = findLrcIndex(lyrics, position)
      if (lyricIndex !== this.store.get().lyricIndex) st.lyricIndex = lyricIndex
    }
    this.store.set(st)
  }
}

export const player = new Player()
