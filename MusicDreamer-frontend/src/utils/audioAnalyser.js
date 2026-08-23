// Web Audio 频谱分析单例：把播放器的 <audio> 接入全局唯一 AudioContext。
// createMediaElementSource 每个元素只能调用一次，因此 ctx/analyser 必须全局复用；
// 接入后声音改走 ctx.destination，所以仅在真正需要频谱时（首次播放）才建立连接，
// 且每次播放前 resume，避免 autoplay 策略导致静音。
let ctx = null
let analyser = null

export function getAnalyser(audioEl) {
  if (!audioEl) return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      const src = ctx.createMediaElementSource(audioEl)
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.78
      src.connect(analyser)
      analyser.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume()
    return analyser
  } catch (e) {
    return null
  }
}
