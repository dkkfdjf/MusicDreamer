import fs from 'fs';
const src = fs.readFileSync('C:/Users/34392/Desktop/项目3/MusicDreamer-frontend/node_modules/weui.js/dist/weui.js', 'utf8');
// dialog.js 的 _hide 完整逻辑（动画结束才清 _sington）与 dialog 入口
let i = src.indexOf('_sington');
console.log('=== _sington occurrences ===');
let j = -1; const spots = [];
while ((j = src.indexOf('_sington', j + 1)) !== -1 && spots.length < 30) spots.push(j);
for (const s of spots) {
  console.log(`@${s}: ...${src.slice(Math.max(0,s-80), s+120).replace(/\n/g,'\n')}...\n`);
}
