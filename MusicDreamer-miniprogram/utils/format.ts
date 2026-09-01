/** 秒 → m:ss；空值 → '--:--' */
export function fmtDuration(sec?: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
