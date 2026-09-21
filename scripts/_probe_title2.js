// Candidate improved cleanTitle algorithm — validate against real titles in data/music/
function isNoise(s) {
  if (/^(?:日推歌单|歌单|官方.*|.*字幕|.*完整版|.*版|MV|PV|MAD|AMV|DL.*|.*Radio|.*Cover|翻自.*)$/i.test(s)) return true;
  return /官方|字幕|歌单|完整|高清|MV|PV/i.test(s);
}

// 全角/半角装饰段 + 描述句截断
function stripDecoration(s) {
  return s.replace(/[【\[][^】\]]*[】\]]/g, " "); // 剥 【】[..]
}

// 判断一段是否像"描述句"：含中文标点(，。！？)或过长(>15字)且含描述动词特征
function looksLikeDescription(s) {
  if (/[，。！？、；]/.test(s)) return true;            // 中文标点=描述句
  // 无标点但很长且像整句
  if (s.length > 15) return true;
  return false;
}

function cleanTitle(rawTitle, rawArtist) {
  let title = (rawTitle || "").trim();
  let artist = (rawArtist || "").trim();
  if (!title) return ["", artist];

  // 1. 书名号/引号优先取歌名
  let m = title.match(/[《「『]([^》」』]{2,60})[》」』]/);
  let matched = null, inner = null;
  if (m) { matched = m[0]; inner = m[1]; }
  if (!matched) {
    let q = title.match(/"([^"]{2,60})"/);
    if (q) { matched = q[0]; inner = q[1]; }
  }
  if (matched) {
    title = inner.replace(/_/g, " ").trim();
    // 书名号后面找歌手：横线分隔的片段
    let after = rawTitle.substring(rawTitle.indexOf(matched) + matched.length);
    let am = after.match(/[-_]{1,3}\s*([^-_【】\[\]()（）]{2,30}?)(?:[-_]|\s|$)/);
    if (am) {
      let cand = am[1].replace(/_/g, " ").trim();
      if (cand && !isNoise(cand) && !artist) artist = cand;
    }
  } else {
    // 2. 剥装饰段
    title = stripDecoration(title).trim();
    // 3. 按【中文/英文边界 + 空格 + 横线】粗拆候选段
    //    先按"横线(可无空格)"拆
    let segs = title.split(/[ ]*[-–—_]+[ ]*/).map(s => s.trim()).filter(Boolean);
    if (segs.length >= 2) {
      // 找描述句段并截断：每段若含中文标点，取标点前
      segs = segs.map(seg => {
        let pm = seg.match(/^[^，。！？、；]+/);
        return pm ? pm[0].trim() : seg;
      }).filter(s => s && !isNoise(s));
      // B站惯例：左侧歌名，右侧歌手；多段时第一段歌名、第二段歌手、其余描述丢弃
      if (segs.length >= 2) {
        title = segs[0];
        if (!artist) artist = segs[1];
      } else {
        title = segs[0] || title;
      }
    } else {
      // 无横线：剥装饰段后整段，按描述句标点截断
      let pm = title.match(/^[^，。！？、；]+/);
      title = pm ? pm[0] : title;
    }
  }

  // 4. 尾部/首部杂音清理
  title = title.replace(/(日推歌单|歌单)$/i, "")
    .replace(/[_.\s\-–—]+$/, "")
    .replace(/^[_.\s\-–—]+/, "")
    .replace(/_/g, " ").trim();
  return [title, artist];
}

const cases = [
  "【4K Hi-Res】晴天-周杰伦",
  "【4K Hi-Res】稻香-周杰伦",
  "【4K60FPS】周杰伦《七里香》封神之作！华语乐坛最美的一首歌",
  "【4K极致修复丨Hi-Res无损】周杰伦 - 听妈妈的话 MV 2160P 歌词重制",
  "【七月的极光   官方MV 】周杰伦 即使当太阳下山了，夜幕低垂时，在七月的极光之中，拥抱爱情等于拥有整个宇宙",
  "【女儿殿下   官方MV 】周杰伦 疯疯癫癫 Hey 风度翩翩 Hey 陪我家公主玩变化万千 Hey",
  "周杰伦-七月的极光",
  "七月的极光-周杰伦",
  "七月的极光 - 周杰伦",
  "《七月的极光》周杰伦",
];

for (const t of cases) {
  const [title, artist] = cleanTitle(t, "");
  console.log("raw   :", t);
  console.log("  → name :", JSON.stringify(title), " artist:", JSON.stringify(artist));
  console.log("");
}
