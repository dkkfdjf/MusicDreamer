import fs from 'fs';
const src = fs.readFileSync('C:/Users/34392/Desktop/项目3/MusicDreamer-frontend/node_modules/weui.js/dist/weui.js', 'utf8');
// 关键：dialog 按钮点击 handler（onClick 返回值判断）+ fade-in/fade-out 动画类绑定
const i = src.indexOf("weui-dialog__btn");
console.log('=== btn click handler ===');
console.log(src.slice(i - 200, i + 700));
