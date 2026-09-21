// 封面 URL 探针：复现「服务器正常、小程序封面不显示」bug
// 数据流 = 服务器原始响应 → 小程序 api 层（resolveUrlsDeep 转换）→ image 组件拿到的值
// 修复前：api 层不转换 → image 收到相对路径 → FAIL；修复后应全 PASS
import { resolveUrlsDeep, resolveUrl } from '../MusicDreamer-miniprogram/config.ts'

const BASE = 'http://106.55.3.235'

async function head(url) {
  if (!url) return { ok: false, reason: 'empty url' }
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const ct = res.headers.get('content-type') || ''
    return { ok: res.status === 200 && ct.startsWith('image/'), reason: `HTTP ${res.status} ${ct}` }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}

// 提取任意 JSON 里所有 coverUrl 字段（含嵌套 records/songs）
function collectCovers(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out
  if (Array.isArray(obj)) return obj.reduce((o, x) => collectCovers(x, o), out)
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'coverUrl' && typeof v === 'string') out.push(v)
    else if (v && typeof v === 'object') collectCovers(v, out)
  }
  return out
}

// 逐字段校验：*Url 字段是否补全成功（含嵌套）
function checkUrlsDeep(v, path, errs, depth = 0) {
  if (v == null || typeof v !== 'object' || depth > 4) return
  if (Array.isArray(v)) return v.forEach((x, i) => checkUrlsDeep(x, `${path}[${i}]`, errs, depth + 1))
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string' && /Url$/.test(k)) {
      const renderable = /^https?:\/\//.test(val) // 小程序 image 可直接渲染的形态
      if (!renderable) errs.push(`${path}.${k}=${val} 未补全为完整 URL`)
    } else if (val && typeof val === 'object') checkUrlsDeep(val, `${path}.${k}`, errs, depth + 1)
  }
}

const endpoints = [
  ['song/chart', '/api/v1/song/chart?type=hot&limit=3'],
  ['recommend/list', '/api/v1/recommend/list?limit=3'],
  ['search/by-style', '/api/v1/search/by-style?page=1&size=3'],
  ['search/songs', '/api/v1/search/songs?keyword=%E5%85%89&page=1&size=3']
]

let fail = 0
for (const [name, path] of endpoints) {
  const res = await fetch(BASE + path)
  const body = await res.json()
  const data = resolveUrlsDeep(body.data) // ← 小程序 api 层实际做的转换
  const errs = []
  checkUrlsDeep(data, name, errs)
  const covers = collectCovers(data)
  if (!covers.length) {
    console.log(`SKIP ${name}: 无 coverUrl 数据`)
    continue
  }
  for (const u of covers) {
    const r = await head(u) // 转换后的完整 URL 必须真实可达
    const ok = !errs.length && r.ok
    if (!ok) fail++
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${name}: coverUrl=${u} 资源可达=${r.ok}(${r.reason})` +
        (errs.length ? ` | ${errs[0]}` : '')
    )
  }
}

// 幂等性：resolveUrl 对完整 URL 原样返回（mini-player/playing/auth 等已有调用点不受影响）
const idem = resolveUrl('http://106.55.3.235/data/cover/6.jpg') === 'http://106.55.3.235/data/cover/6.jpg'
console.log(idem ? 'PASS resolveUrl 幂等性' : 'FAIL resolveUrl 幂等性')
if (!idem) fail++

console.log(fail === 0 ? '\n✅ 全部通过' : `\n❌ ${fail} 项失败`)
process.exit(fail === 0 ? 0 : 1)
