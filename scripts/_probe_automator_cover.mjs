// automator 取证：连上开发者工具，检查小程序运行时 image 实际渲染的 src
import automator from 'miniprogram-automator'

const cli = 'D:\\学习\\微信开发者工具\\微信web开发者工具\\cli.bat'
const projectPath = 'C:\\Users\\34392\\Desktop\\项目3\\MusicDreamer-miniprogram'

console.log('launching devtools...')
const mini = await automator.launch({
  cliPath: cli,
  projectPath,
  timeout: 60000
})
console.log('launched, pid=', mini.artifact && mini.artifact.pid)

try {
  const page = await mini.reLaunch('/pages/home/home')
  await page.waitFor(3000)

  // 1. 运行时验证：api 层函数是否真的在编译产物里（在 home 页上下文执行）
  const probe = await page.callMethod(
    'eval_runtime_probe',
    {}
  ).catch((e) => 'callMethod-failed: ' + e.message)

  // home 页没有该方法，改用 evaluate 的替代：直接查 image 元素
  const images = await page.$$('song-item .si-cover')
  console.log('song-item cover images found:', images.length)
  for (const img of images.slice(0, 3)) {
    const src = await img.attribute('src')
    console.log('  image src =', src)
  }

  // 2. 首页其它封面（推荐区若有）
  const imgs2 = await page.$$('image')
  console.log('total image nodes:', imgs2.length)
  for (const img of imgs2.slice(0, 6)) {
    console.log('  image src =', await img.attribute('src'))
  }

  // 3. 控制台错误
  mini.on('console', (msg) => console.log('[console]', msg.type, msg.args && msg.args.join(' ')))
} finally {
  await mini.close()
}
