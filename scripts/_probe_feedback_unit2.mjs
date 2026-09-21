import fs from 'fs';
const src = fs.readFileSync('C:/Users/34392/Desktop/项目3/MusicDreamer-frontend/node_modules/weui.js/dist/weui.js', 'utf8');
console.log('total length:', src.length);
// 找 confirm 所有出现点
let i = -1; const spots = [];
while ((i = src.indexOf('confirm', i + 1)) !== -1 && spots.length < 40) spots.push(i);
console.log('occurrences:', spots.length);
for (const s of spots.slice(0, 40)) {
  const ctx = src.slice(Math.max(0, s - 40), s + 60).replace(/\n/g, '\n');
  console.log(`@${s}: ...${ctx}...`);
}
