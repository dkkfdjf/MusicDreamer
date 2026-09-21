// 求歌下载 bug 埋点探针（第二次运行，现场已恢复为待处理）：
// 拦截 weui.confirm 调用 + 记录 /download 响应体 + 未处理异常 + dialog DOM 增删
import { chromium } from 'playwright';
import fs from 'fs';

const shots = 'C:/Users/34392/Desktop/项目3/scripts/_shots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: false, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
// 记录所有 /api/ 响应（含 body，重点 download 调用）
page.on('response', async (r) => {
  const url = r.url();
  if (!url.includes('/api/')) return;
  let body = '';
  try { body = (await r.text()).slice(0, 300); } catch (e) { body = '<no body>'; }
  logs.push(`[api ${r.status()}] ${r.request().method()} ${url.replace('http://localhost:5173', '')} → ${body}`);
});

// 1. 登录
await page.goto('http://localhost:5173/login');
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button:has-text("登录")');
await page.waitForTimeout(2500);

// 2. 管理后台 → 求歌处理
await page.goto('http://localhost:5173/admin');
await page.waitForTimeout(1500);
await page.locator('.el-tabs__item:has-text("求歌处理")').click();
await page.waitForTimeout(1200);

// 3. 点搜索入库（打开 drawer + bilisearch）
await page.locator('button:has-text("搜索入库")').first().click();
logs.push('--- 搜索入库 clicked, waiting bilisearch...');
await page.waitForTimeout(12000);
const cards = await page.locator('.req-card').count();
logs.push('--- candidate cards: ' + cards);

// 4. 埋点：拦截 weui.confirm、监听 dialog DOM、捕获全局异常
await page.evaluate(async () => {
  window.__ev = { confirmCalls: [], dialogs: [], errors: [] };
  window.addEventListener('error', (e) => window.__ev.errors.push('error: ' + e.message + ' @ ' + e.filename + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => window.__ev.errors.push('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message))));
  const mod = await import('/@id/weui.js');
  const weui = mod.default || mod;
  const origConfirm = weui.confirm.bind(weui);
  weui.confirm = function (...args) {
    window.__ev.confirmCalls.push({
      content: String(args[0]).slice(0, 50),
      title: args[3] && args[3].title,
      staleDialogsBefore: document.querySelectorAll('.weui-dialog').length,
      stack: new Error().stack.split('\n').slice(2, 5).join(' | ')
    });
    return origConfirm(...args);
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && n.querySelector && n.querySelector('.weui-dialog')) window.__ev.dialogs.push('added@' + Date.now() % 100000);
      }
      for (const n of m.removedNodes) {
        if (n.nodeType === 1 && n.querySelector && n.querySelector('.weui-dialog')) window.__ev.dialogs.push('removed@' + Date.now() % 100000);
      }
    }
  }).observe(document.body, { childList: true });
});
logs.push('--- instrumentation ready');

// 5. 点第一张候选卡片 → 第一个 confirm
await page.locator('.req-card').first().click();
await page.waitForTimeout(1000);
logs.push('--- after card click: dialogs=' + await page.locator('.weui-dialog').count());

// 6. 点 开始下载
const okBtn = page.locator('.weui-dialog__btn:has-text("开始下载")');
if (await okBtn.count()) {
  await okBtn.click();
  logs.push('--- 开始下载 clicked');
  for (const waitMs of [800, 1200, 2000]) {
    await page.waitForTimeout(waitMs);
    const st = await page.evaluate(() => ({
      dialogs: document.querySelectorAll('.weui-dialog').length,
      dialogVisible: [...document.querySelectorAll('.weui-dialog')].map(d => {
        const cs = getComputedStyle(d);
        return { opacity: cs.opacity, display: cs.display, anim: cs.animationName };
      }),
      elMessages: document.querySelectorAll('.el-message').length,
      weuiToasts: document.querySelectorAll('.weui-toast').length,
      ev: window.__ev
    }));
    logs.push(`--- +${waitMs}ms: ` + JSON.stringify(st));
  }
  await page.screenshot({ path: shots + '/6-instrumented-end.png' });
  // 若第二个 confirm 出现了，点"创建并继续"走完整流程
  const ok2 = page.locator('.weui-dialog__btn:has-text("创建并继续")');
  if (await ok2.count()) {
    await ok2.click();
    logs.push('--- 创建并继续 clicked');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: shots + '/7-after-ensure.png' });
  }
} else {
  logs.push('--- !!! 开始下载 button NOT found, dialogs=' + await page.locator('.weui-dialog').count());
  await page.screenshot({ path: shots + '/6-no-ok-btn.png' });
}

fs.writeFileSync(shots + '/instrumented-log.txt', logs.join('\n'), 'utf8');
console.log(logs.join('\n'));
await browser.close();
