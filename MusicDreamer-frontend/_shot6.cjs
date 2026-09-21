// Capture shot6: 纯手动求歌表单（侧栏"求歌"入口，无识曲预填）
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // login -> token
  const loginRes = await page.request.post('http://localhost:8080/api/v1/user/login', {
    data: { username: 'admin', password: 'admin123' }
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data && (loginJson.data.token || loginJson.data.tokenValue) || loginJson.token;
  if (!token) { console.error('no token', JSON.stringify(loginJson).slice(0,300)); await browser.close(); process.exit(1); }

  await page.goto('http://localhost:5173');
  await page.evaluate((t) => localStorage.setItem('md_token', t), token);
  await page.evaluate(() => localStorage.setItem('md_user', JSON.stringify({id:1,username:'admin',role:2,singerStatus:2})));
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // click side-nav "求歌"
  await page.locator('.nav-item:has-text("求歌")').click().catch(() => {});
  // fallback: dispatch the same event the nav button dispatches
  await page.evaluate(() => window.dispatchEvent(new Event('md-open-song-request')));
  await page.waitForTimeout(1500);

  // ensure dialog open & form empty (no prefill since we didn't set prefill)
  const dialog = page.locator('.el-dialog').filter({ hasText: '求歌' });
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'C:\\Users\\34392\\Desktop\\项目3\\report_shots\\shot6.png' });
  console.log('SHOT6 saved');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
