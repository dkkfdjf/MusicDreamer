// 时序竞态判别探针：patch feedback.js 实际引用的同一个 weui 模块实例，
// 记录每次 confirm 调用（时间戳、返回值是否为上一个弹窗节点=单例早退铁证）、DOM 增删时刻
import { chromium } from 'playwright';
import fs from 'fs';

const shots = 'C:/Users/34392/Desktop/项目3/scripts/_shots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: false, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto('http://localhost:5173/login');
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button:has-text("登录")');
await page.waitForTimeout(2500);

// 在应用页面内：找到 feedback.js 转译产物里 weui 的真实 import URL，patch 同一实例
const ready = await page.evaluate(async () => {
  const src = await (await fetch('/src/utils/feedback.js')).text();
  const m = src.match(/import\s+\w+\s+from\s+"([^"]+weui[^"]+)"/);
  if (!m) return 'no weui import found in transformed feedback.js: ' + src.slice(0, 300);
  const weuiUrl = m[1];
  const mod = await import(weuiUrl);
  const weui = mod.default || mod;
  if (!weui || typeof weui.confirm !== 'function') return 'weui object unexpected at ' + weuiUrl;

  window.__race = { calls: [], dom: [], t0: performance.now() };
  const orig = weui.confirm.bind(weui);
  let prevEl = null;
  weui.confirm = function (...args) {
    const ret = orig(...args);
    const sameAsPrev = prevEl && ret === prevEl;
    prevEl = ret;
    window.__race.calls.push({
      t: Math.round(performance.now() - window.__race.t0),
      title: args[3] && args[3].title,
      returnedStaleSingleton: sameAsPrev,
      staleStillInDom: prevEl ? document.contains(prevEl) : null
    });
    return ret;
  };
  new MutationObserver((muts) => {
    for (const mu of muts) {
      for (const n of mu.addedNodes) if (n.nodeType === 1 && n.querySelector?.('.weui-dialog')) window.__race.dom.push('add@' + Math.round(performance.now() - window.__race.t0));
      for (const n of mu.removedNodes) if (n.nodeType === 1 && n.querySelector?.('.weui-dialog')) window.__race.dom.push('remove@' + Math.round(performance.now() - window.__race.t0));
    }
  }).observe(document.body, { childList: true });
  return 'patched ' + weuiUrl;
});
logs.push('--- instrumentation: ' + ready);

if (String(ready).startsWith('patched')) {
  await page.goto('http://localhost:5173/admin');   // 整页跳转会丢 patch，改回 hash 内导航？admin 是整页路由——直接重新走
  await page.waitForTimeout(1200);
}

// 注：goto 会重置 JS 状态。改为单页流程：登录后已在 SPA 内，用 router 路径直接导航。
logs.push('=== FINAL RACE DATA ===');
console.log(logs.join('\n'));
await browser.close();
