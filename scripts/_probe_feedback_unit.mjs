// 直接在 Node 里验证 feedback.js 的 confirm 封装与 weui confirm 的参数兼容性。
// weui.confirm(content, yes, no, options)：options.buttons[i].onClick 在 dialog.js 里这样调用：
//   options.buttons[index].onClick.call(this, evt) !== false → hide()
// feedback.js 里 buttons onClick 是 () => reject(...) / () => resolve(true)，都返回 undefined → !== false → hide()。OK。
// 关键嫌疑：weui.confirm(content, yes, no, options) 中 options.buttons 会 **整体覆盖** 默认按钮，
// 而 feedback.js 又在 options 里传 buttons —— 但同时还传了 yes/no 回调，没被用到（无害）。
// 再看 confirm.js:53 签名确认 options 归属。
import fs from 'fs';
const src = fs.readFileSync('C:/Users/34392/Desktop/项目3/MusicDreamer-frontend/node_modules/weui.js/dist/weui.js', 'utf8');
// 在 minified bundle 里找 confirm 的实现片段，看参数重载逻辑
const idx = src.indexOf('confirm:function');
console.log('confirm:function found at', idx);
if (idx > 0) console.log(src.slice(idx, idx + 600).replace(/;/g, ';\n'));
