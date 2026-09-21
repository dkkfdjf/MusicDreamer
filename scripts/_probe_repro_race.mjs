// 复现/验证探针 v3：直接驱动**修复后的 feedback.js 封装**（与线上同代码路径）
// 红灯预期（修复前）：第二次 confirm 后 dialogs=0 且封装修复前 Promise 永不 settle
// 绿灯预期（修复后）：两个弹窗依次出现，p1/p2 都正确 settle，且紧邻调用不被吞
import { chromium } from 'playwright';
import fs from 'fs';

const shots = 'C:/Users/34392/Desktop/项目3/scripts/_shots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const log = (s) => { logs.push(s); console.log(s); };

await page.goto('http://localhost:5173/login');
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button:has-text("登录")');
await page.waitForTimeout(2000);

// step1: import 修复后的 feedback.js（走 Vite 同一模块图，与业务组件同实例）
await page.evaluate(() => {
  return import('/src/utils/feedback.js').then(fb => {
    window.__fb = fb;
    window.__st = {};
    // 与 pickCandidate 相同的用法：await confirm(...) → 点确定 → 立刻再 confirm
    (async () => {
      try {
        await fb.confirm('第一次确认框', { title: '下载入库', okText: '开始下载' });
        window.__st.p1 = 'resolved';
      } catch (e) { window.__st.p1 = 'rejected:' + e.message; }
      // p1 settle 后**零延时**立刻弹第二个（复刻 bug 的紧邻时序）
      try {
        await fb.confirm('第二次确认框：歌手还没有账号，是否自动创建？', { title: '创建歌手账号', okText: '创建并继续' });
        window.__st.p2 = 'resolved';
      } catch (e) { window.__st.p2 = 'rejected:' + e.message; }
    })();
  });
});
await page.waitForTimeout(500);
const d1 = await page.locator('.weui-dialog').count();
log('step1 firstDialog=' + d1);

// step2: 点"开始下载"（触发内部 await 链：p1 settle → 立即弹第二窗）
if (d1 > 0) {
  await page.locator('.weui-dialog__btn:has-text("开始下载")').click();
  // 按**文字**等真正的第二窗（旧窗淡出期间 count 仍为 1，不能按数量判）
  let d2 = 0;
  try {
    await page.waitForSelector('.weui-dialog:has-text("创建歌手账号")', { timeout: 5000 });
    d2 = 1;
  } catch (e) { d2 = 0; }
  const txt = d2 > 0 ? await page.locator('.weui-dialog').innerText() : '(none)';
  log('step2 secondDialog=' + d2 + ' text=' + txt.slice(0, 45).replace(/\n/g, '|'));
  const st = await page.evaluate(() => window.__st);
  log('step3 p1=' + st.p1 + ' p2=' + st.p2);

  // step4: 第二窗点"创建并继续"，验证整链走通
  if (d2 > 0) {
    await page.locator('.weui-dialog__btn:has-text("创建并继续")').click();
    await page.waitForTimeout(800);
    log('step4 afterCreate dialogs=' + await page.locator('.weui-dialog').count() + ' st=' + JSON.stringify(await page.evaluate(() => window.__st)));
  }
} else {
  log('!! first dialog never appeared');
}

await page.screenshot({ path: shots + '/7-repro-race.png' });
fs.writeFileSync(shots + '/repro-race-log.txt', logs.join('\n'), 'utf8');
await browser.close();
