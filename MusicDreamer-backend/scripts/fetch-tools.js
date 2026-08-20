#!/usr/bin/env node
/**
 * fetch-tools.js —— 媒体处理工具一键拉取（团队协作机制）
 *
 * 用法：
 *   node scripts/fetch-tools.js            # 拉取 yt-dlp / ffmpeg / whisper-cli 到 tools/
 *   node scripts/fetch-tools.js --models   # 追加拉取 whisper 模型（默认 base）到 tools/models/
 *   node scripts/fetch-tools.js --models small,medium
 *
 * 约定：tools.manifest.json（进 Git）锁定来源与校验；tools/ 目录（二进制）不进 Git。
 * 可靠性逻辑与后端 TOOL_UPDATE 任务一致：流式写入 .part、失败切镜像源、体积校验后转正。
 */
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

const ROOT = path.resolve(__dirname, "..");
const TOOLS_DIR = path.join(ROOT, "tools");
const MODELS_DIR = path.join(TOOLS_DIR, "models");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "tools.manifest.json"), "utf8"));

const PLATFORM = process.platform === "win32" ? "win" : "linux";

async function download(url, destFile, minBytes) {
  const partFile = destFile + ".part";
  let attempt = 0;
  const urls = [url];
  // github 直链失败时依次切换代理镜像
  if (url.includes("github.com") && !url.includes("ghproxy")) {
    for (const p of ["https://ghproxy.net/", "https://gh-proxy.com/", "https://ghproxy.com/"]) {
      urls.push(p + url);
    }
  }
  for (const u of urls) {
    attempt++;
    process.stdout.write(`  [${attempt}/${urls.length}] 下载 ${u}\n`);
    try {
      const res = await fetch(u, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get("content-length") || 0);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partFile));
      const size = fs.statSync(partFile).size;
      if (minBytes && size < minBytes) throw new Error(`体积校验失败：${size} < ${minBytes}`);
      fs.renameSync(partFile, destFile);
      process.stdout.write(`  完成 ${(size / 1048576).toFixed(1)}MB -> ${path.relative(ROOT, destFile)}\n`);
      return destFile;
    } catch (e) {
      process.stdout.write(`  失败：${e.message}\n`);
      if (fs.existsSync(partFile)) fs.rmSync(partFile);
    }
  }
  throw new Error("全部来源下载失败");
}

async function unzip(file, targetDir) {
  // 使用系统 unzip（Windows Git Bash / Linux 均自带）
  const { execSync } = require("child_process");
  fs.mkdirSync(targetDir, { recursive: true });
  execSync(`unzip -q -o "${file}" -d "${targetDir}"`, { stdio: "inherit" });
  fs.rmSync(file);
}

async function fetchTools() {
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  for (const t of manifest.tools) {
    const spec = t[PLATFORM];
    if (!spec) { console.log(`跳过 ${t.name}（无 ${PLATFORM} 配置：${t.note || ""}）`); continue; }
    console.log(`== ${t.name} (${t.version})`);
    const dest = path.join(TOOLS_DIR, spec.target);
    if (spec.unzip) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const already = (spec.binary || []).some(b => fs.existsSync(path.join(TOOLS_DIR, b)));
      if (already) { console.log("  已存在，跳过"); continue; }
      const zip = path.join(TOOLS_DIR, `${t.name}.zip`);
      await download(spec.url, zip, spec.minBytes);
      await unzip(zip, TOOLS_DIR);
    } else {
      if (fs.existsSync(dest)) { console.log("  已存在，跳通"); continue; }
      await download(spec.url, dest, spec.minBytes);
      if (PLATFORM === "linux") fs.chmodSync(dest, 0o755);
    }
  }
}

async function fetchModels(keys) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  for (const key of keys) {
    const m = manifest.models.find(x => x.key === key);
    if (!m) throw new Error(`未知模型规格：${key}`);
    const dest = path.join(MODELS_DIR, `ggml-${key}.bin`);
    if (fs.existsSync(dest)) { console.log(`模型 ${key} 已存在，跳过`); continue; }
    console.log(`== whisper 模型 ${key}（${m.sizeText}）`);
    try {
      await download(m.url, dest, 1048576);
    } catch {
      await download(m.fallback, dest, 1048576);
    }
  }
  console.log("提示：启动后在管理端-模型管理可切换当前规格");
}

(async () => {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--models")) {
      const idx = args.indexOf("--models");
      const keys = args[idx + 1] ? args[idx + 1].split(",") : ["base"];
      await fetchModels(keys);
    } else {
      await fetchTools();
      console.log("\n完成。tools/ 目录已就绪（勿提交 Git）。");
    }
  } catch (e) {
    console.error("拉取失败：", e.message);
    process.exit(1);
  }
})();
