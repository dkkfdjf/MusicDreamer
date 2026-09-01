// 生成 tabBar PNG 图标（81x81，纯像素绘制，无外部依赖）
// 用法：node scripts/gen-icons.js
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 81

// 简单符号绘制：返回 81x81 布尔网格（true=有像素）
function drawHome() {
  // 房子：屋顶三角 + 方身 + 门
  const g = mkGrid()
  const cx = 40
  for (let y = 14; y <= 34; y++) {
    // 屋顶：等腰三角，边宽 5px
    const half = y - 14
    for (let x = cx - half; x <= cx + half; x++) {
      const onEdge = x <= cx - half + 4 || x >= cx + half - 4
      if (onEdge) g[y][x] = true
    }
  }
  for (let y = 34; y <= 62; y++) {
    // 房身两侧竖线
    for (let x = 20; x <= 24; x++) g[y][x] = true
    for (let x = 56; x <= 60; x++) g[y][x] = true
  }
  g[62] && null
  for (let x = 20; x <= 60; x++) for (let y = 60; y <= 64; y++) g[y][x] = true
  // 门
  for (let y = 46; y <= 62; y++) for (let x = 35; x <= 45; x++) {
    if (y <= 48 || x <= 37 || x >= 43 || y === 62) g[y][x] = true
  }
  return g
}
function drawSquare() {
  // 罗盘/圆环 + 指针
  const g = mkGrid()
  const cx = 40, cy = 40, R = 26
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    if (d <= R && d >= R - 5) g[y][x] = true
  }
  // 指针（菱形）
  for (let i = 0; i <= 14; i++) {
    for (let j = 0; j <= i; j++) {
      g[40 - 14 + i][40 - j] = true
      g[40 - 14 + i][40 + j] = true
    }
  }
  return g
}
function drawLibrary() {
  // 三本书：两竖一斜
  const g = mkGrid()
  for (let y = 18; y <= 62; y++) {
    for (let x = 18; x <= 28; x++) g[y][x] = y === 18 || y === 62 || x === 18 || x === 28
    for (let x = 34; x <= 44; x++) g[y][x] = y === 18 || y === 62 || x === 34 || x === 44
  }
  // 斜书
  for (let y = 0; y <= 44; y++) {
    const x0 = 50 + Math.round(y * 0.22)
    for (let x = x0; x <= x0 + 10; x++) {
      if (y === 0 || y === 44 || x === x0 || x === x0 + 10) {
        if (g[y + 18]) g[y + 18][x] = true
      }
    }
  }
  return g
}
function drawMine() {
  // 人：头圆 + 肩弧
  const g = mkGrid()
  const cx = 40, hy = 28, hr = 11
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const d = Math.sqrt((x - cx) ** 2 + (y - hy) ** 2)
    if (d <= hr && d >= hr - 5) g[y][x] = true
    // 肩：大圆上半弧
    const d2 = Math.sqrt((x - cx) ** 2 + ((y - 72) * 1.35) ** 2)
    if (d2 <= 26 && d2 >= 21 && y <= 60) g[y][x] = true
  }
  return g
}
function mkGrid() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(false))
}

// 网格 → RGBA 像素；color=[r,g,b]，无像素处透明
function rasterize(grid, color) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  let p = 0
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0 // filter none
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x]) {
        raw[p++] = color[0]; raw[p++] = color[1]; raw[p++] = color[2]; raw[p++] = 255
      } else {
        raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0
      }
    }
  }
  return raw
}

// 最小 PNG 编码器（IHDR/IDAT/IEND）
function encodePng(rgbaRaw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crcTable = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
    let crc = 0xffffffff
    for (const b of td) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
    crc = (crc ^ 0xffffffff) >>> 0
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc)
    return Buffer.concat([len, td, crcBuf])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const idat = zlib.deflateSync(rgbaRaw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const GRAY = [138, 133, 124] // #8a857c 未选中
const BRAND = [255, 107, 26] // #ff6b1a 选中

const icons = {
  'tab-home': drawHome,
  'tab-square': drawSquare,
  'tab-library': drawLibrary,
  'tab-mine': drawMine
}

const outDir = path.join(__dirname, '..', 'assets')
fs.mkdirSync(outDir, { recursive: true })
for (const [name, draw] of Object.entries(icons)) {
  const g = draw()
  fs.writeFileSync(path.join(outDir, name + '.png'), encodePng(rasterize(g, GRAY)))
  fs.writeFileSync(path.join(outDir, name + '-on.png'), encodePng(rasterize(g, BRAND)))
  console.log('generated', name + '.png /', name + '-on.png')
}
