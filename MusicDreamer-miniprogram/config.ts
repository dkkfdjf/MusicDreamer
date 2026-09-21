// 后端地址：开发者工具需勾选「不校验合法域名」（后端目前是 HTTP）
export const STATIC_BASE = 'http://106.55.3.235'
export const BASE_URL = STATIC_BASE + '/api/v1'

/** 后端返回的 /data/... 相对路径 → 完整 URL；已是 http(s) 原样返回 */
export function resolveUrl(url?: string | null): string {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return STATIC_BASE + url
}

/** 递归补全对象/数组里所有 *Url 字段的相对路径（对已完整 URL 幂等；depth 防循环引用） */
export function resolveUrlsDeep(v: any, depth = 0): any {
  if (v == null || typeof v !== 'object' || depth > 4) return v
  if (Array.isArray(v)) {
    v.forEach((x, i) => (v[i] = resolveUrlsDeep(x, depth + 1)))
    return v
  }
  for (const k of Object.keys(v)) {
    const val = v[k]
    if (typeof val === 'string' && /Url$/.test(k)) v[k] = resolveUrl(val)
    else resolveUrlsDeep(val, depth + 1)
  }
  return v
}
