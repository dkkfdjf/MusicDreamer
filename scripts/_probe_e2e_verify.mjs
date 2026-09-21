// 端到端复验（按 _probe_req_instrumented.mjs 同链路）：验证 missingSinger → 第二确认框 → 创建歌手 → 下载任务
// 成功判据：/download 返回 missingSinger → 出现"创建歌手账号"弹窗 → 点创建并继续 → ensure-singer 200 → 二次 /download 返回 taskId
import { chromium } from 'playwright';
import fs from 'fs';

const shots = 'C:/Users/34392/Desktop/项目3/scripts/_shots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', async (r) => {
  const url = r.url();
  if (!url.includes('/api/')) return;
  let body = '';
  try { body = (await r.text()).slice(0, 220); } catch (e) { body = '<no body>'; }
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

// 3. 搜索入库（drawer + bilisearch 候选）
await page.locator('button:has-text("搜索入库")').first().click();
logs.push('--- 搜索入库 clicked, waiting bilisearch...');
await page.waitForTimeout(12000);
const cards = await page.locator('.req-card').count();
logs.push('--- candidate cards: ' + cards);

// 4. 点第一张候选卡片 → 第一个确认框（下载入库）
await page.locator('.req-card').first().click();
await page.waitForSelector('.weui-dialog:has-text("下载入库")', { timeout: 5000 });
logs.push('--- first confirm shown (下载入库)');

// 5. 点开始下载 → /download 返回 missingSinger → 第二个确认框（创建歌手账号）
await page.locator('.weui-dialog__btn:has-text("开始下载")').click();
logs.push('--- 开始下载 clicked, waiting 创建歌手账号 dialog...');

// 按**文字**等真正的第二窗（旧窗淡出约 0.3s，期间 count 仍为 1）
let secondShown = false;
try {
  await page.waitForSelector('.weui-dialog:has-text("创建歌手账号")', { timeout: 8000 });
  secondShown = true;
  logs.push('--- ✓ second confirm shown (创建歌手账号) —— bug fixed');
} catch (e) {
  logs.push('--- ✗ second confirm NOT shown within 8s —— bug still present');
}
await page.screenshot({ path: shots + '/8-e2e-second-dialog.png' });

// 6. 点创建并继续 → ensure-singer + 二次 /download → taskId
if (secondShown) {
  await page.locator('.weui-dialog__btn:has-text("创建并继续")').click();
  logs.push('--- 创建并继续 clicked');
  // 等二次 download 响应（ensure-singer + 重新搜索下载，可能几秒）
  await page.waitForTimeout(6000);
  await page.screenshot({ path: shots + '/9-e2e-final.png' });
}

fs.writeFileSync(shots + '/e2e-verify-log.txt', logs.join('\n'), 'utf8');
console.log(logs.join('\n'));
await browser.close();
