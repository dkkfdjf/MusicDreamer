// 验证 weui dialog 单例卡死：连续两次 confirm（模拟 pickCandidate 中 first confirm → requestDownload → missingSinger → second confirm）
// 若第二次 confirm 没有出现在 DOM 中 → _sington 未复位，根因坐实
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
await page.waitForTimeout(2000);

// 直接在页面上下文里复现：引入 weui 后连续两次 confirm（与 feedback.js 同参格式）
const result = await page.evaluate(async () => {
  // UMD in Vite dev: bare import path may not transform; use Vite's optimized dep 'weui.js'
  const mod = await import('/@id/weui.js');
  const weui = mod.default || mod;
  const out = {};

  // 第一次 confirm（模拟"下载入库"确认框）
  const p1 = new Promise((resolve, reject) => {
    weui.confirm('第一次确认框', () => resolve('yes1'), () => reject(new Error('cancel1')), {
      title: '下载入库',
      buttons: [
        { label: '取消', type: 'default', onClick: () => reject(new Error('cancel')) },
        { label: '开始下载', type: 'primary', onClick: () => resolve('yes1') }
      ]
    });
  }).catch(e => 'rejected:' + e.message);

  await new Promise(r => setTimeout(r, 400));
  out.dialogAfterFirst = document.querySelectorAll('.weui-dialog').length;

  // 点"开始下载"
  const btn = document.querySelector('.weui-dialog__btn_primary');
  if (btn) btn.click();
  const r1 = await p1;
  out.firstResult = r1;
  await new Promise(r => setTimeout(r, 800)); // 等 fade-out + animationend
  out.dialogAfterClose = document.querySelectorAll('.weui-dialog').length;

  // 第二次 confirm（模拟 missingSinger → "创建歌手账号"确认框）
  const p2 = new Promise((resolve, reject) => {
    weui.confirm('第二次确认框：歌手还没有账号，是否自动创建？', () => resolve('yes2'), () => reject(new Error('cancel2')), {
      title: '创建歌手账号',
      buttons: [
        { label: '取消', type: 'default', onClick: () => reject(new Error('cancel')) },
        { label: '创建并继续', type: 'primary', onClick: () => resolve('yes2') }
      ]
    });
  }).catch(e => 'rejected:' + e.message);

  await new Promise(r => setTimeout(r, 400));
  out.dialogAfterSecond = document.querySelectorAll('.weui-dialog').length;
  out.secondDialogText = out.dialogAfterSecond > 0 ? document.querySelector('.weui-dialog')?.innerText?.slice(0, 80) : null;

  // 尝试点第二次的按钮
  const btn2 = document.querySelector('.weui-dialog__btn_primary');
  if (btn2) btn2.click();
  out.secondResult = await p2;
  await new Promise(r => setTimeout(r, 800));
  out.dialogAtEnd = document.querySelectorAll('.weui-dialog').length;
  return out;
});

logs.push('=== RESULT ===');
logs.push(JSON.stringify(result, null, 2));
console.log(logs.join('\n'));
await page.screenshot({ path: shots + '/5-weui-singleton-probe.png' });
await browser.close();
