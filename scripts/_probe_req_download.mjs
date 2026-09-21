// 求歌下载无反应问题探针：真实浏览器重现 用户登录 → 求歌处理 tab → 搜索入库 → 点候选卡片
// 抓取：页面 console、请求失败、弹窗 DOM 状态、network 请求
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const shots = 'C:/Users/34392/Desktop/项目3/scripts/_shots';
import fs from 'fs';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: false, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    logs.push(`[api ${r.status()}] ${r.request().method()} ${r.url()}`);
  }
});

// 1. 登录
await page.goto(BASE + '/login');
await page.fill('input[placeholder*="用户名"], input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button:has-text("登录")');
await page.waitForTimeout(2500);
logs.push('--- logged in, url: ' + page.url());

// 2. 进管理后台 → 求歌处理 tab
await page.goto(BASE + '/admin');
await page.waitForTimeout(1500);
const reqTab = page.locator('.el-tabs__item:has-text("求歌处理")');
if (await reqTab.count()) {
  await reqTab.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shots + '/1-requests-tab.png' });
  logs.push('--- requests tab opened, rows: ' + await page.locator('.el-table__row').count());

  // 3. 点搜索入库
  const searchBtn = page.locator('button:has-text("搜索入库")').first();
  if (await searchBtn.count()) {
    await searchBtn.click();
    logs.push('--- clicked 搜索入库, waiting for drawer + bilisearch...');
    // bilisearch 实测 4~8 秒，给足时间
    await page.waitForTimeout(12000);
    await page.screenshot({ path: shots + '/2-drawer-candidates.png' });
    const cards = await page.locator('.req-card').count();
    logs.push('--- candidate cards: ' + cards);

    if (cards > 0) {
      // 4. 点第一张候选卡片 → 应弹 weui confirm
      await page.locator('.req-card').first().click();
      logs.push('--- clicked candidate card');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: shots + '/3-after-card-click.png' });

      // 检查 weui confirm 弹窗是否出现
      const dlg = await page.locator('.weui-dialog').count();
      logs.push('--- weui-dialog count after click: ' + dlg);

      if (dlg > 0) {
        const dlgText = await page.locator('.weui-dialog').first().innerText();
        logs.push('--- dialog text: ' + dlgText.replace(/\n/g, ' | '));
        // 点"开始下载"
        const okBtn = page.locator('.weui-dialog__btn:has-text("开始下载")');
        if (await okBtn.count()) {
          await okBtn.click();
          logs.push('--- clicked 开始下载');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: shots + '/4-after-ok.png' });
          // 看是否有请求发出
        } else {
          logs.push('--- !!! 开始下载 button NOT found');
        }
      } else {
        logs.push('--- !!! NO weui-dialog appeared after card click — root cause zone');
      }
    } else {
      logs.push('--- no candidates (bilisearch empty/failed)');
    }
  } else {
    logs.push('--- 搜索入库 button not found');
  }
} else {
  logs.push('--- 求歌处理 tab not found');
}

logs.push('=== ALL CONSOLE/NETWORK LOGS ===');
fs.writeFileSync(shots + '/probe-log.txt', logs.join('\n'), 'utf8');
console.log(logs.join('\n'));
await page.waitForTimeout(1500);
await browser.close();
