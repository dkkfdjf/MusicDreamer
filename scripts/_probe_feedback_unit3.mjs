import fs from 'fs';
const src = fs.readFileSync('C:/Users/34392/Desktop/项目3/MusicDreamer-frontend/node_modules/weui.js/dist/weui.js', 'utf8');
// confirm.js 源码函数体在 bundle 里：function confirm(content, yes, no, options)
let i = src.indexOf('function confirm(');
while (i !== -1) {
  console.log('=== function confirm( @', i, '===');
  console.log(src.slice(i, i + 900));
  console.log();
  i = src.indexOf('function confirm(', i + 1);
}
