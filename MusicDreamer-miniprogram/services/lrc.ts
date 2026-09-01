// LRC 歌词解析：[mm:ss.xx] 多时间标签展开 → [{time(秒), text}] 升序
export interface LrcLine {
  time: number
  text: string
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(text: string): LrcLine[] {
  if (!text) return []
  const out: LrcLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0
    const stamps: number[] = []
    let m: RegExpExecArray | null
    let lastEnd = 0
    while ((m = TIME_TAG.exec(raw)) !== null) {
      // 时间标签必须连续出现在行首（元数据标签 [xx:...] 混排时跳过）
      if (m.index !== lastEnd) break
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const fracRaw = m[3] || '0'
      const frac = parseInt(fracRaw, 10) / Math.pow(10, fracRaw.length)
      stamps.push(min * 60 + sec + frac)
      lastEnd = TIME_TAG.lastIndex
    }
    if (!stamps.length) continue
    const content = raw.slice(lastEnd).trim()
    for (const t of stamps) out.push({ time: t, text: content })
  }
  return out.sort((a, b) => a.time - b.time)
}

/** 二分找当前时间应显示的行（最后一个 time <= t 的行；t 早于首行返回 -1） */
export function findLrcIndex(lines: LrcLine[], t: number): number {
  if (!lines.length || t < lines[0].time) return -1
  let lo = 0
  let hi = lines.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (lines[mid].time <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}
