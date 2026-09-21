// 一次性演示脚本：自动搜索 Steam 商店并截图（只浏览，不登录不购买）
import { chromium } from 'playwright';

const OUT = 'C:/temp/docwork';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });

// 1) 打开搜索页
await page.goto('https://store.steampowered.com/search/?term=' + encodeURIComponent('Black Myth: Wukong'),
  { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#search_resultsRows .search_result_row', { timeout: 45000 });
await page.screenshot({ path: `${OUT}/steam_search.png` });
const firstName = await page.$eval('#search_resultsRows .search_result_row .title', el => el.textContent.trim());
const firstPrice = await page.$eval('#search_resultsRows .search_result_row .discount_final_price', el => el.textContent.trim()).catch(() => '(无价格信息)');
console.log('搜索完成，第一条结果:', firstName, '| 价格:', firstPrice);

// 2) 点击第一条结果进入商店详情页
await page.click('#search_resultsRows .search_result_row');
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(2500);

// 3) 如遇出生日期年龄门，自动填 1995-01-01 通过
if (await page.$('#app_agegate')) {
  console.log('遇到年龄确认页，自动填写出生日期通过…');
  await page.selectOption('select[name="age_day"]', '1').catch(() => {});
  await page.selectOption('select[name="age_month"]', 'January').catch(() => {});
  await page.selectOption('select[name="age_year"]', '1995').catch(() => {});
  await page.click('#app_agegate form button, #app_agegate form input[type=submit]').catch(() => {});
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
}

await page.screenshot({ path: `${OUT}/steam_game.png` });
const gameName = await page.$eval('#appHubAppName', el => el.textContent.trim()).catch(() => '(未取到标题)');
console.log('详情页标题:', gameName);

await browser.close();
console.log('OK');
