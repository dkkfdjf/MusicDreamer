// Drive MusicDreamer Web to capture shot5 = AI 歌词链路进行中（LyricsPanel 任务进度）
// Strategy: play a song, open LyricsPanel, trigger startFetch (一键获取/重新获取),
// then rapidly screenshot to capture the in-progress stage (LRCLIB→本地校准 ~25%).
const { chromium } = require('playwright')
const http = require('http')

const FRONT = 'http://localhost:5173'
const BACK = { host: 'localhost', port: 8080 }

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const opt = { hostname: BACK.host, port: BACK.port, path: '/api/v1' + path, headers: token ? { Authorization: 'Bearer ' + token } : {}, timeout: 5000 }
    http.get(opt, res => { let s = ''; res.on('data', d => s += d); res.on('end', () => { try { resolve(JSON.parse(s)) } catch (e) { reject(e) } }) }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')) })
  })
}
function apiPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const headers = { 'Content-Type': 'application/json' }
    if (data) headers['Content-Length'] = Buffer.byteLength(data)
    if (token) headers['Authorization'] = 'Bearer ' + token
    const req = http.request({ hostname: BACK.host, port: BACK.port, path: '/api/v1' + path, method: 'POST', headers, timeout: 8000 }, res => { let s = ''; res.on('data', d => s += d); res.on('end', () => { try { resolve(JSON.parse(s)) } catch (e) { reject(e) } }) })
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (data) req.write(data); req.end()
  })
}

;(async () => {
  const loginRes = await apiPost('/user/login', { username: 'admin', password: 'admin123' })
  const token = loginRes.data.token
  console.log('token len', token.length)

  const browser = await chromium.launch({ channel: 'msedge', headless: false })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text().slice(0, 250)) })

  // inject token then go home
  await page.goto(FRONT + '/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => {
    localStorage.setItem('md_token', t)
    localStorage.setItem('md_user', JSON.stringify({ userId: 1, nickname: '系统管理员', avatar: '', role: 2, singerStatus: 0 }))
  }, token)
  await page.goto(FRONT + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  // expose pinia stores on window via app instance (runtime injection, no source change)
  const storesReady = await page.evaluate(() => {
    const el = document.getElementById('app')
    const app = el && (el.__vue_app__ || el.__vueApp__)
    if (app && app.config && app.config.globalProperties && app.config.globalProperties.$pinia) {
      const pinia = app.config.globalProperties.$pinia
      window.__stores = {
        player: pinia._s.get('player'),
        lyrics: pinia._s.get('lyrics'),
        user: pinia._s.get('user'),
        tasks: pinia._s.get('mediaTasks')
      }
      return !!window.__stores.lyrics
    }
    return false
  })
  console.log('stores exposed:', storesReady)

  // drive play via store directly (reliable): song id=13 七里香
  const playRes = await page.evaluate((id) => {
    if (!window.__stores || !window.__stores.player) return { ok: false, reason: 'no store' }
    window.__stores.player.playSong({ id, name: '', singer: '' })
    return { ok: true }
  }, 13)
  console.log('playSong(13):', JSON.stringify(playRes))
  await page.waitForTimeout(2500)

  const curName = await page.evaluate(() => window.__stores && window.__stores.player.current && window.__stores.player.current.name)
  console.log('player.current.name:', curName)

  // open lyrics panel
  await page.evaluate(() => window.__stores.lyrics.togglePanel())
  await page.waitForTimeout(1300)

  let st = await page.evaluate(() => {
    const l = window.__stores.lyrics
    return { panelOpen: l.panelOpen, hasLyrics: l.hasLyrics, source: l.source, sourceLabel: l.sourceLabel, fetchTask: l.fetchTask }
  })
  console.log('lyrics state after open:', JSON.stringify(st))

  // trigger startFetch via store
  await page.evaluate(() => window.__stores.lyrics.startFetch())
  await page.waitForTimeout(300)
  // also POST via API to ensure a task exists (deduped if already running)
  let apiTask = null
  try {
    const r = await apiPost('/media/lyrics/fetch/13', null, token)
    const d = r.data || r
    if (d.taskId) apiTask = d.taskId
    console.log('api fetch taskId:', apiTask, 'deduped:', d.deduped)
  } catch (e) { console.log('api fetch err', e.message) }

  // capture rapidly across the in-progress window; pick best
  const shots = []
  const start = Date.now()
  for (let i = 0; i < 14; i++) {
    const ui = await page.evaluate(() => {
      const task = document.querySelector('.lyrics-pane .task')
      return {
        paneOpen: !!document.querySelector('.lyrics-pane'),
        taskVisible: !!task,
        stage: document.querySelector('.lyrics-pane .task-stage')?.textContent?.trim() || '',
        pct: document.querySelector('.lyrics-pane .task-pct')?.textContent?.trim() || '',
        barW: document.querySelector('.lyrics-pane .task-bar i')?.style?.width || '',
        emptyTitle: document.querySelector('.lyrics-pane .empty-title')?.textContent?.trim() || '',
        emptySub: document.querySelector('.lyrics-pane .empty-sub')?.textContent?.trim().replace(/\s+/g, ' ') || '',
        badge: document.querySelector('.lyrics-pane .badge')?.textContent?.trim() || '',
        songName: document.querySelector('.lyrics-pane .song-name')?.textContent?.trim() || ''
      }
    }).catch(() => ({}))
    let api = {}
    try {
      const active = await apiGet('/media/tasks/active', token)
      const list = (active.data || active) || []
      const t = Array.isArray(list) ? list.find(x => String(x.taskType) === 'LYRICS_FETCH') : null
      if (t) {
        const full = await apiGet('/media/task/' + (t.id || t.taskId), token)
        const d = full.data || full
        api = { id: d.id || t.id, status: d.status, progress: d.progress, stage: d.stage }
      }
    } catch (e) {}
    const elapsed = Date.now() - start
    console.log(`cand ${i} +${elapsed}ms:`, JSON.stringify({ stage: ui.stage, pct: ui.pct, barW: ui.barW, badge: ui.badge, taskVis: ui.taskVisible, apiStatus: api.status, apiP: api.progress, apiStage: (api.stage || '').slice(0, 34) }))
    const path = `C:/Users/34392/Desktop/项目3/report_shots/_cand_${i}.png`
    await page.screenshot({ path })
    shots.push({ i, elapsed, ui, api, path })
    await page.waitForTimeout(450)
  }

  // pick best: in-progress RUNNING 10..60, prefer the descriptive 本地校准 stage and higher-but-in-range progress
  let best = null
  for (const s of shots) {
    const pct = parseInt((s.ui.pct || '').replace('%', ''), 10)
    const apiP = s.api.progress
    const inRange = s.api.status === 'RUNNING' && apiP >= 10 && apiP <= 60
    const stageOk = !!(s.ui.stage && s.ui.stage.length > 2)
    const taskVis = s.ui.taskVisible
    // prefer stage that mentions 本地校准/命中 (shows the 3-tier chain most fully)
    const richStage = /本地校准|已命中在线歌词|转写|时间轴/.test(s.ui.stage || '')
    const score = (inRange ? 100 : 0) + (taskVis ? 20 : 0) + (stageOk ? 15 : 0) + (richStage ? 30 : 0) + (apiP > 0 ? Math.min(apiP, 1) : 0)
    if (!best || score > best.score) best = { ...s, score }
  }
  console.log('BEST idx:', best.i, 'score', best.score, JSON.stringify({ ui: { stage: best.ui.stage, pct: best.ui.pct, barW: best.ui.barW, badge: best.ui.badge, taskVis: best.ui.taskVisible, emptyTitle: best.ui.emptyTitle }, api: { status: best.api.status, progress: best.api.progress, stage: best.api.stage } }))

  const fs = require('fs')
  fs.copyFileSync(best.path, 'C:/Users/34392/Desktop/项目3/report_shots/shot5.png')
  console.log('copied best -> shot5.png')
  for (const s of shots) { try { fs.unlinkSync(s.path) } catch (e) {} }

  await page.waitForTimeout(1200)
  await browser.close()
  console.log('DONE')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
