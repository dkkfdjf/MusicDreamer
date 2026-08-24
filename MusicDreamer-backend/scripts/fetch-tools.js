#!/usr/bin/env node
/**
 * fetch-tools.js —— 媒体处理工具一键拉取（团队协作机制）
 *
 * 用法：
 *   node scripts/fetch-tools.js            # 拉取 yt-dlp / ffmpeg / whisper-cli 到 tools/bin/
 *   node scripts/fetch-tools.js --models   # 追加拉取 whisper 模型（默认 small）到 data/models/
 *   node scripts/fetch-tools.js --models small,medium
 *   node scripts/fetch-tools.js --nacos    # 拉取 Nacos 2.2.3 到 tools/nacos（无 Docker 机器用）
 *
 * 约定：tools.manifest.json（进 Git）锁定来源与校验；tools/ 目录（二进制）不进 Git。
 * 可靠性逻辑与后端 TOOL_UPDATE 任务一致：流式写入 .part、失败切镜像源、体积校验后转正。
 * 注意：解压依赖 unzip（Git Bash 自带），请在 Git Bash 里执行，别用 cmd/PowerShell。
 */
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

const ROOT = path.resolve(__dirname, "..");
const TOOLS_DIR = path.join(ROOT, "tools");
// 模型必须放 data/models/（StorageService.modelsDir() 的首选探测位置），
// 放 tools/models/ 只会在 data/models 不存在时才被兜底读到
const MODELS_DIR = path.join(ROOT, "data", "models");
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

// 在解压树里递归找指定文件名（zip 内部目录结构不固定）
function findFile(root, name) {
  const direct = path.join(root, name);
  if (fs.existsSync(direct)) return direct;
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return null; }
  for (const d of entries) {
    if (d.isDirectory()) {
      const r = findFile(path.join(root, d.name), name);
      if (r) return r;
    }
  }
  return null;
}

async function fetchTools() {
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  for (const t of manifest.tools) {
    const spec = t[PLATFORM];
    if (!spec) { console.log(`跳过 ${t.name}（无 ${PLATFORM} 配置：${t.note || ""}）`); continue; }
    console.log(`== ${t.name} (${t.version})`);
    const dest = path.join(TOOLS_DIR, spec.target);
    if (spec.unzip) {
      // 统一布局：解压到临时目录，只把 binary 列表里的文件挑进 tools/bin/，
      // 其余（ffplay / bench / test 等无关产物）不进项目
      const already = (spec.binary || []).every(b =>
        fs.existsSync(path.join(TOOLS_DIR, "bin", b)));
      if (already) { console.log("  已存在，跳过"); continue; }
      const zip = path.join(TOOLS_DIR, `${t.name}.zip`);
      await download(spec.url, zip, spec.minBytes);
      const tmp = path.join(TOOLS_DIR, `_unzip_${t.name}`);
      await unzip(zip, tmp);
      fs.mkdirSync(path.join(TOOLS_DIR, "bin"), { recursive: true });
      for (const b of spec.binary || []) {
        const src = findFile(tmp, b);
        if (src) fs.copyFileSync(src, path.join(TOOLS_DIR, "bin", b));
        else console.log(`  警告：压缩包中未找到 ${b}`);
      }
      fs.rmSync(tmp, { recursive: true, force: true });
    } else {
      if (fs.existsSync(dest)) { console.log("  已存在，跳过"); continue; }
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

// Nacos 注册中心：无 Docker 的机器拉到 tools/nacos，
// 配合 scripts/nacos-start.cmd 启动（yml 默认连 localhost:8848）
async function fetchNacos() {
  const spec = (manifest.infra || []).find(i => i.name === "nacos");
  if (!spec) throw new Error("manifest 中无 nacos 配置");
  const destDir = path.join(TOOLS_DIR, "nacos");
  const hasStartup = fs.existsSync(path.join(destDir, "bin", "startup.cmd")) ||
      fs.existsSync(path.join(destDir, "bin", "startup.sh"));
  if (hasStartup) { console.log("nacos 已存在，跳过（如需重装先删 tools/nacos）"); return; }
  console.log(`== nacos ${spec.version}（注册中心，约130MB，Docker 起基础设施的无需此项）`);
  const zip = path.join(TOOLS_DIR, "nacos.zip");
  await download(spec.url, zip, spec.minBytes);
  const tmp = path.join(TOOLS_DIR, "_unzip_nacos");
  await unzip(zip, tmp);
  // 压缩包顶层就是 nacos/ 目录，整体落位到 tools/nacos
  fs.rmSync(destDir, { recursive: true, force: true });
  const nested = path.join(tmp, "nacos");
  fs.renameSync(fs.existsSync(nested) ? nested : tmp, destDir);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("完成：双击 scripts/nacos-start.cmd 即可启动（需 JDK 17+）");
}

(async () => {
  const args = process.argv.slice(2);
  try {
    if (args.includes("--nacos")) {
      await fetchNacos();
    } else if (args.includes("--models")) {
      const idx = args.indexOf("--models");
      const keys = args[idx + 1] ? args[idx + 1].split(",") : ["small"];
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
