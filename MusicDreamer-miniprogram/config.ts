// 后端地址：开发者工具需勾选「不校验合法域名」（后端目前是 HTTP）
export const STATIC_BASE = 'http://106.55.3.235'
export const BASE_URL = STATIC_BASE + '/api/v1'

/** 后端返回的 /data/... 相对路径 → 完整 URL；已是 http(s) 原样返回 */
export function resolveUrl(url?: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return STATIC_BASE + url
}
