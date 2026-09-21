// 探针：求歌处理 tab 按钮不显示问题——看真实渲染 + 捕获 JS 错误
import { chromium } from 'playwright';
import fs from 'fs';

const shots = 'C:/Users/34392/Desktop/项目3/scripts/_shots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ headless: false, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[console.${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) logs.push(`[api ${r.status()}] ${r.request().method()} ${r.url()}`);
});

await page.goto('http://localhost:5173/login');
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button:has-text("登录")');
await page.waitForTimeout(2000);

await page.goto('http://localhost:5173/admin');
await page.waitForTimeout(1200);
await page.locator('.el-tabs__item:has-text("求歌处理")').click();
await page.waitForTimeout(1500);

// 表格结构证据：每行 status tag 文本 + 操作列内容
const rows = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('.el-table')];
  const out = [];
  for (const t of tables) {
    for (const tr of t.querySelectorAll('.el-table__body tr')) {
      const cells = [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\n/g, '|'));
      out.push(cells);
    }
  }
  return out;
});
logs.push('--- rows: ' + JSON.stringify(rows, null, 1));

const btnSearch = await page.locator('button:has-text("搜索入库")').count();
const btnReject = await page.locator('button:has-text("拒绝")').count();
const btnDelete = await page.locator('button:has-text("删除")').count();
logs.push(`--- buttons: 搜索入库=${btnSearch} 拒绝=${btnReject} 删除=${btnDelete}`);

// 操作列是否被挤没：量一下最后一个 th/td 的宽度
const colWidth = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')];
  const last = ths[ths.length - 1];
  if (!last) return 'no th';
  const r = last.getBoundingClientRect();
  return { text: last.innerText, width: r.width, visible: r.width > 0 };
});
logs.push('--- 操作列: ' + JSON.stringify(colWidth));

await page.screenshot({ path: shots + '/8-req-buttons-probe.png', fullPage: true });
fs.writeFileSync(shots + '/8-req-buttons-log.txt', logs.join('\n'), 'utf8');
console.log(logs.join('\n'));
await browser.close();
