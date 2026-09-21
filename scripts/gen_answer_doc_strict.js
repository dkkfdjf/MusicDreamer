// 严格按模板原格式生成答辩文档：直接在模板 document.xml 上做定点替换
// 保留模板全部原文（章节标题/说明/示例格式/标签），仅替换占位符与示例内容
// 用法: node scripts/gen_answer_doc_strict.js
const fs = require('fs');
const { execSync } = require('child_process');

const TEMPLATE = 'C:/Users/34392/Desktop/悦享音乐项目答辩文档.docx';
const WORKDIR = process.env.TEMP + '/md_docx_strict';
const TAR = 'C:\\Windows\\System32\\tar.exe';
const OUT = 'C:/Users/34392/Desktop/歌曲求歌下载入库功能答辩文档_模板格式.docx';

// ---------- 解压模板 ----------
fs.rmSync(WORKDIR, { recursive: true, force: true });
fs.mkdirSync(WORKDIR, { recursive: true });
execSync(`"${TAR}" -xf "${TEMPLATE}" -C "${WORKDIR}"`);
let xml = fs.readFileSync(WORKDIR + '/word/document.xml', 'utf8');

// ---------- XML 工具 ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 代码行/正文行：与模板示例一致的无样式段落（默认字体，xml:space 保留缩进）
const codeP = (line) =>
  `<w:p><w:r><w:t xml:space="preserve">${esc(line.length ? line : ' ')}</w:t></w:r></w:p>`;
const textP = (text) => codeP(text);
// 小节标题：与模板章节标题一致的加粗段落
const boldP = (text) =>
  `<w:p><w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
// 含 emoji 的行：emoji 用 Segoe UI Emoji run（与模板运行效果示例同款写法）
const EMOJI_RE = /^((?:\p{Extended_Pictographic}|‍|️)+)/u;
const emojiP = (line) => {
  const m = line.match(EMOJI_RE);
  if (!m) return codeP(line);
  return `<w:p><w:r><w:rPr><w:rFonts w:ascii="Segoe UI Emoji" w:hAnsi="Segoe UI Emoji" w:cs="Segoe UI Emoji"/></w:rPr><w:t xml:space="preserve">${esc(m[1])}</w:t></w:r><w:r><w:t xml:space="preserve">${esc(line.slice(m[1].length))}</w:t></w:r></w:p>`;
};

// 定位包含某文本的整个 <w:p>...</w:p> 并整体替换
function replaceParaContaining(text, newXml, label) {
  const t = xml.indexOf(text);
  if (t < 0) throw new Error('未找到锚点: ' + label);
  const pStart = Math.max(xml.lastIndexOf('<w:p ', t), xml.lastIndexOf('<w:p>', t));
  const pEnd = xml.indexOf('</w:p>', t) + '</w:p>'.length;
  xml = xml.slice(0, pStart) + newXml + xml.slice(pEnd);
}

// 定位表格：anchor 为表内唯一文本；返回 [表起始, 表结束)
function tableRange(anchor) {
  const a = xml.indexOf(anchor);
  if (a < 0) throw new Error('未找到表格锚点: ' + anchor);
  const s = xml.lastIndexOf('<w:tbl>', a);
  const e = xml.indexOf('</w:tbl>', a) + '</w:tbl>'.length;
  return [s, e];
}
// 拆 <w:tr> / <w:tc> / 取 <w:tcPr>
function splitRows(tbl) {
  const rows = []; let i = 0;
  while (true) {
    const s = tbl.indexOf('<w:tr', i); if (s < 0) break;
    const e = tbl.indexOf('</w:tr>', s) + '</w:tr>'.length;
    rows.push(tbl.slice(s, e)); i = e;
  }
  return rows;
}
function splitCells(tr) {
  const cells = []; let i = 0;
  while (true) {
    const s = tr.indexOf('<w:tc>', i); if (s < 0) break;
    const e = tr.indexOf('</w:tc>', s) + '</w:tc>'.length;
    cells.push(tr.slice(s, e)); i = e;
  }
  return cells;
}
const tcPrOf = (tc) => tc.slice(tc.indexOf('<w:tcPr>'), tc.indexOf('</w:tcPr>') + '</w:tcPr>'.length);
// 用样例行克隆新行：保留每格 tcPr，正文换成无样式段落
const makeRow = (patternCells, texts) => '<w:tr>' +
  patternCells.map((c, i) => `<w:tc>${tcPrOf(c)}<w:p><w:r><w:t xml:space="preserve">${esc(texts[i])}</w:t></w:r></w:p></w:tc>`).join('') + '</w:tr>';

// ---------- ① 标题 ----------
xml = xml.replace(/(<w:t[^>]*>)项目技术流程说明文档(<\/w:t>)/, '$1歌曲求歌下载入库功能答辩文档$2');

// ---------- ② 表1（流程概述）：填充 4 个空单元格 ----------
function fillAfterLabel(label, paras) {
  const li = xml.indexOf('<w:t>' + label + '</w:t>');
  if (li < 0) throw new Error('未找到标签: ' + label);
  // 标签所在 tc 结束后，紧随其后的 tc 即为待填充的空单元格
  const s = xml.indexOf('<w:tc>', xml.indexOf('</w:tc>', li));
  const e = xml.indexOf('</w:tc>', s) + '</w:tc>'.length;
  const cell = xml.slice(s, e);
  // 复用原 <w:tc> 开标签（含 tcPr），只替换其中的段落部分
  const openEnd = cell.indexOf('>') + 1;
  const open = cell.slice(0, openEnd);                 // "<w:tc>"
  const rest = cell.slice(openEnd);                    // "<w:tcPr>...<w:p>...</w:p></w:tc>"
  const tcprEnd = rest.indexOf('</w:tcPr>') + '</w:tcPr>'.length;
  const newCell = open + rest.slice(0, tcprEnd) + paras + '</w:tc>';
  xml = xml.slice(0, s) + newCell + xml.slice(e);
}
fillAfterLabel('流程名称', textP('歌曲求歌-下载-入库全流程（求歌 → 链接下载 → 自动入库 → 歌词/指纹后置处理 → 求歌自动回填）'));
fillAfterLabel('核心目标', textP('用户"留歌名求歌"后，管理员从 B 站候选中选定链接，系统以异步任务方式自动完成：yt-dlp 下载音频、ffmpeg 转码 MP3 320k、正式落盘、写入歌曲库（待审核）、歌词三级降级获取与时间轴校准、听歌识曲指纹采集，最后自动回填求歌状态。全程进度可视、可取消、失败自动重试，管理员无需手工搬运任何文件。'));
fillAfterLabel('输入', textP('① 用户的求歌申请（歌名 + 可选歌手名，或识曲未命中自动预填）；② 管理员从候选中选定的 B 站视频链接'));
fillAfterLabel('输出', textP('一首完整入库的歌曲：music/{歌名}.mp3（320k）+ 封面 + .lrc 歌词 + 响度增益（LUFS）+ 指纹倒排索引（fp_hash 表）；同时 song_request 记录状态从"待处理"自动流转为"已入库"并关联 result_song_id'));

// ---------- ③ 表2（关键数据流转）：示例 5 行换成真实 13 行 ----------
const DATAFLOW = [
  ['用户输入', '求歌 JSON', '{"title": "起风了", "artist": "买辣椒也用券", "source": 0}'],
  ['落库', 'song_request 记录', 'status=0 待处理, result_song_id=NULL'],
  ['管理员候选搜索', 'yt-dlp JSON 候选数组', 'bilisearch5:起风了 → [{title, duration, url, cover}, …×5]'],
  ['选定候选建任务', 'URL 带回填标记 + media_task 记录', 'https://b23.tv/xxx?reqid=12 → {task_type: DOWNLOAD, status: PENDING, progress: 0}'],
  ['yt-dlp 下载中', 'stdout 进度行 → 任务进度字段', '[download] 45.3% → {progress: 27, stage: "正在下载音频… 45%"}'],
  ['ffmpeg 转码后', '临时音频文件', 'data/task/12_out.mp3（MP3 320k）'],
  ['Feign 入库', '歌曲 JSON → song 表记录', '{name: "起风了", status: 1 审核中, fileUrl: "/data/task/12_out.mp3"}'],
  ['正式落盘后', '最终文件 + 地址回写', 'music/起风了.mp3 + fileUrl → "/data/music/起风了.mp3"'],
  ['歌词回写', '校准后的 LRC 文本 + 数据库指针', '[00:26.50]我曾将青春翻涌成她 → lyric/起风了.lrc，song.lyric_url 回写'],
  ['指纹采集', 'PCM → 哈希倒排索引', 'fp_hash(hash, song_id, pos) 数千行/首'],
  ['响度回写', 'LUFS 增益字段', 'volume_gain = -16 - (-23.4) = 7.4dB'],
  ['求歌回填', 'song_request 状态流转', 'status=1 已入库, result_song_id=88, handled_by=管理员'],
  ['前端轮询', '任务状态 JSON', '{status: "SUCCESS", progress: 100, stage: "完成", musicId: 88}'],
];
{
  const [s, e] = tableRange('<w:t>阶段</w:t>');
  const tbl = xml.slice(s, e);
  const rows = splitRows(tbl);
  const pattern = splitCells(rows[1]);           // 第一个示例行作样式样版
  if (pattern.length !== 3) throw new Error('表2 样例行单元格数异常: ' + pattern.length);
  const gridEnd = tbl.indexOf(rows[0]);
  const newTbl = tbl.slice(0, gridEnd) + rows[0] + DATAFLOW.map(r => makeRow(pattern, r)).join('') + '</w:tbl>';
  xml = xml.slice(0, s) + newTbl + xml.slice(e);
}

// ---------- ④ 表3（核心难点）：示例行+2空行换成真实 3 行，表后加指纹亮点 ----------
const DIFFS = [
  ['① B 站 412 风控拦截下载', '两层防护缺一不可：第 1 层保持 yt-dlp 最新版本；第 2 层自动调用 B 站 finger/spi 接口领取匿名 buvid cookie 写入 Netscape 格式文件（缓存 1 小时），配合 Chrome UA + Referer 头。另外下载任务全局单并发（CAS 信号量），主动降低触发风控的请求频率。命中 412 时元数据阶段自动重试一次，最终失败则经错误转译表翻译成用户可读文案，绝不把原始 stderr 抛给用户。'],
  ['② 任务取消与重复消费：多 worker 竞态', '三重保障：(a) 分发时用条件 UPDATE 原子抢占——仅当库中仍是 PENDING 才置 RUNNING，抢占失败即放弃，杜绝恢复期多 worker 重复执行；(b) finish() 加终态保护——已 SUCCESS/FAILED/CANCELLED 的任务拒绝任何迟到覆写，否则"取消形同虚设"；(c) 取消按 cancelKey kill 已登记进程 + finally 必清 *_temp* 孤儿文件，服务重启后 SelfHealRunner 把遗留 RUNNING 置 FAILED、保留 PENDING 续跑。'],
  ['③ 歌词时间轴校准：在线词库对不上本地音源', 'B 站搬运版常有剪辑/偏移，直接用在线 LRC 会全程错位。方案：whisper 本地快速转写提供"真实演唱时刻"，再与在线轴单调配对（游标只前进 + 文本 bigram 相似度，防副歌相似句错配）；并区分两种情况——时长差 ≤2s 判"同版本"，只做全局微移（±2.5s 封顶）不逐句改写（whisper 单句噪声大于在线轴自身误差，曾因过度校准引发真实事故）；时长差大才是剪辑版，走"锚点剔野（区分阶跃与孤峰）+ 线性插值"。纯文本命中时用区间 DP 吸收转写句拆行挂时刻，对不上宁可保留纯文本，也不写错误时间轴。'],
];
{
  const [s, e] = tableRange('<w:t>示例：如何防止工具调用进入死循环？</w:t>');
  const tbl = xml.slice(s, e);
  const rows = splitRows(tbl);
  const pattern = splitCells(rows[1]);
  if (pattern.length !== 2) throw new Error('表3 样例行单元格数异常: ' + pattern.length);
  const gridEnd = tbl.indexOf(rows[0]);
  const bonus = textP('加分亮点——听歌识曲指纹没用现成的 chromaprint/fpcalc：实测其指纹带长时程依赖，任意位置切片与全曲指纹比特一致率仅 0.56（与异曲 0.55 无区分），是"文件识别"不是"识曲"算法。因此自研 Shazam 式 landmark 指纹（STFT → 峰点 → hash → 偏移投票），真实曲库验证同曲 435 票 / 异曲 5 票，且支持任意位置冷启动切片定位。');
  const newTbl = tbl.slice(0, gridEnd) + rows[0] + DIFFS.map(r => makeRow(pattern, r)).join('') + '</w:tbl>';
  xml = xml.slice(0, s) + newTbl + bonus + xml.slice(e);
}

// ---------- ⑤ 流程图占位符：文字步骤 + Mermaid ----------
const STEPS = [
  '方式C——文字步骤列表（共 12 步）：',
  '① 用户提交求歌（歌名/歌手，识曲未命中可自动预填），同用户同歌名的待处理申请自动去重，落库 song_request，状态=0 待处理；',
  '② 管理员在管理页"求歌处理"tab 点"搜索入库"，后端执行 yt-dlp -J "bilisearch5:歌名" 返回前 5 条候选（标题/时长/封面，超 10 分钟标红疑似合集）；',
  '③ 若本地曲库已有同名已发布歌曲，直接关联完成求歌（不重复下载）；否则管理员选定候选，URL 追加 reqid 标记，创建 media_task 下载任务（PENDING 排队）；',
  '④ 任务引擎每 2 秒轮询分发：下载任务全局单并发（降低风控），以"仅当库中仍是 PENDING 才置 RUNNING"的条件 UPDATE 原子抢占，防多 worker 重复消费；',
  '⑤ 下载阶段：yt-dlp --dump-single-json 取元数据（30s 超时，命中 412 风控自动重试一次）→ yt-dlp 下载最优音频流（stdout 逐行正则解析 [download] xx% 线性映射到总进度 0-60%）→ ffmpeg 转码 MP3 320k（60-75%）；',
  '⑥ Feign 跨服务入库 Mod_music：歌曲状态=1 审核中（管理员操作直发），先指向 task 临时目录；失败自动回 PENDING，30 秒后重试（至多 3 次）；',
  '⑦ 正式落盘：临时文件移动到 music/{清洗后的歌名}.mp3（同名兜底追加 -songId 防覆盖），封面同理落 image/，随后把 song.fileUrl 从临时地址回写为正式地址；',
  '⑧ 求歌自动回填：从任务 URL 摘出 reqid，把对应 song_request 置为 1 已入库并关联 result_song_id、记录处理人；回填失败不影响主流程（管理页可手动回填兜底）；',
  '⑨ 后置任务（线程池并行）：歌词三级降级获取（LRCLIB 在线词库 → 来源视频 CC 字幕 → whisper 本地 AI 转写），命中在线同步歌词后再用本地转写结果做逐句时间轴校准，落盘 .lrc 并回写数据库；',
  '⑩ 响度分析：ffmpeg ebur128 测出集成响度 LUFS，按目标 -16 LUFS 计算增益回写 song 表（播放端补偿，不重编码）；',
  '⑪ 指纹采集：自研 Shazam 式 landmark 指纹（PCM → STFT → 峰点 → hash），写入 fp_hash 倒排索引，供听歌识曲任意位置切片匹配；',
  '⑫ 任务 SUCCESS、清理临时文件；前端任务浮窗全程 1.5 秒轮询展示进度/阶段并支持取消（取消即 kill 进程 + 删临时文件 + 置 CANCELLED）。',
  '',
  '方式A——Mermaid 源码（粘贴到 mermaid.live 可在线渲染）：',
];
const MERMAID = [
  'flowchart TD',
  '    A["用户提交求歌(歌名/歌手)"] --> B{"同用户同歌名已有待处理?"}',
  '    B -- 是 --> B1["去重复用"]',
  '    B -- 否 --> C["song_request 状态=0 待处理"]',
  '    C --> D["管理员: yt-dlp -J bilisearch5:歌名 取前5候选"]',
  '    D --> E{"本地曲库已有同名已发布歌曲?"}',
  '    E -- 是 --> Z["直接关联 → 求歌状态=1 已入库"]',
  '    E -- 否 --> F["选定候选建下载任务(URL+reqid) → media_task PENDING"]',
  '    F --> G["调度器每2秒分发·下载单并发·原子抢占PENDING→RUNNING"]',
  '    G --> H["yt-dlp 取元数据(412自动重试)"]',
  '    H --> I["yt-dlp 下载音频 0-60% (stdout正则解析进度)"]',
  '    I --> J["ffmpeg 转码MP3 320k 60-75%"]',
  '    J --> K["Feign入库 Mod_music 状态=1审核中 (失败回PENDING重试≤3次)"]',
  '    K --> L["正式落盘 music/{歌名}.mp3 + 回写fileUrl"]',
  '    L --> M["求歌自动回填: reqid → 状态=1已入库"]',
  '    M --> N["后置任务并行"]',
  '    N --> N1["歌词三级降级: LRCLIB→CC字幕→whisper转写+时间轴校准"]',
  '    N --> N2["响度: ffmpeg ebur128 → LUFS增益回写"]',
  '    N --> N3["指纹: STFT峰点hash → fp_hash倒排索引"]',
  '    N1 & N2 & N3 --> O["SUCCESS·清理临时文件"]',
  '    I -.失败.-> R["错误转译(412风控/超时)·不暴露stderr"]',
  '    G -.任意阶段.-> T["取消: kill进程+删临时文件+CANCELLED"]',
];
replaceParaContaining('[在此处粘贴你的流程图]',
  STEPS.concat(MERMAID).map(codeP).join(''), '流程图占位符');

// ---------- ⑥ 核心代码占位符：6 段真实代码 ----------
const CODE_SECTIONS = [
  ['3.1 任务引擎：2 秒轮询分发 + 原子抢占（后端 TaskManager.java）',
    '代码作用：任务队列的核心——定时轮询 PENDING 任务并分发，下载任务单并发（降低 B 站风控概率），用"仅当库里仍是 PENDING 才置 RUNNING"的条件 UPDATE 原子抢占，防止多 worker 重复消费同一任务。', [
      '@Scheduled(fixedDelay = 2000)                       // 每 2 秒轮询一次 PENDING 任务',
      'public void dispatch() {',
      '    if (!ready) return;                             // 自愈检查未完成前不分发',
      '    List<MediaTask> pending = mapper.selectList(    // 按 id 升序取最早 20 条待处理任务',
      '            ... eq(status, "PENDING").orderByAsc(id).last("limit 20"));',
      '    for (MediaTask t : pending) {',
      '        Long after = retryAfter.get(t.getId());',
      '        if (after != null && now < after) continue; // 失败重试的延迟窗口未到，跳过',
      '        if (DOWNLOAD.equals(t.getTaskType())) {',
      '            // 关键：下载任务单并发——CAS 抢占信号量，已有下载在跑则本轮跳过',
      '            if (!downloadBusy.compareAndSet(false, true)) continue;',
      '            run(t, () -> downloadBusy.set(false));',
      '        } else {',
      '            workerPool.submit(() -> run(t, () -> { }));  // 其他任务进普通线程池',
      '        }',
      '    }',
      '}',
      '',
      'private void run(MediaTask t, Runnable release) {',
      '    // 关键：原子抢占——仅当库里仍是 PENDING 才置 RUNNING（条件 UPDATE）。',
      '    // 恢复期多个 worker 可能同时领到同一任务，无条件覆写会把已完成任务改回 RUNNING',
      '    int claimed = mapper.update(null, new LambdaUpdateWrapper<MediaTask>()',
      '            .eq(MediaTask::getId, t.getId())',
      '            .eq(MediaTask::getStatus, "PENDING")       // 双重条件 = 原子抢占',
      '            .set(MediaTask::getStatus, "RUNNING"));',
      '    if (claimed != 1) { release.run(); return; }       // 抢占失败 = 别人已领走',
      '    try {',
      '        runnerLocator.runner(t.getTaskType()).run(t);  // 分发到对应 TaskRunner(如 DownloadJob)',
      '    } finally { release.run(); }',
      '}',
      '',
      'public void progress(int taskId, int value, String stage) {   // 进度上报：500ms 节流',
      '    Long last = lastProgressAt.get(taskId);',
      '    if (last != null && now - last < 500) return;   // 500ms 节流，避免高频写库',
      '    t.setProgress(Math.max(0, Math.min(100, value)));',
      '    mapper.updateById(t);',
      '    broadcast(t, "PROGRESS");                        // WebSocket 推给前端任务浮窗',
      '}',
      '',
      'public void finish(int taskId, String status, String error) { // 终态保护',
      '    // 关键：已进终态(尤其 CANCELLED)的任务，迟到的收尾结果不得覆盖——否则取消形同虚设',
      '    if ("SUCCESS".equals(cur) || "FAILED".equals(cur) || "CANCELLED".equals(cur)) return;',
      '    ...',
      '}',
    ]],
  ['3.2 进程执行器：外部工具调用唯一出口（ProcessExecutor.java）',
    '代码作用：统一封装 yt-dlp / ffmpeg / whisper 等外部进程调用，落实六条强约束——数组参数防注入、全异步、stderr 必收、stdout 缓冲上限、超时强杀、按 cancelKey 取消。', [
      'public CompletableFuture<ExecResult> run(List<String> cmd, long timeoutMs,',
      '                                         Consumer<String> onLine, String cancelKey) {',
      '    ProcessBuilder pb = new ProcessBuilder(cmd);     // 关键：参数列表，绝不拼 shell 字符串(防注入)',
      '    pb.redirectErrorStream(false);                   // stdout 与 stderr 双流分离收集',
      '    Process p = pb.start();',
      '    running.put(cancelKey, p);                       // 登记进程，供取消时 kill',
      '    // 守护线程逐行读 stdout：既回调给上层解析进度，又累计缓冲(上限 10MB 防巨输出)',
      '    CompletableFuture.runAsync(() -> reader(p.getInputStream(), onLine, stdout));',
      '    // stderr 必须单独收集：ffmpeg 的 ebur128 响度结果在 stderr 里',
      '    CompletableFuture.runAsync(() -> reader(p.getErrorStream(), null, stderr));',
      '    timers.schedule(() -> p.destroyForcibly(), timeoutMs, MILLISECONDS);  // 超时强制销毁',
      '    ...',
      '}',
      '',
      'public boolean cancel(String cancelKey) {            // 前端"取消任务"最终走到这里',
      '    Process p = running.remove(cancelKey);',
      '    if (p != null && p.isAlive()) { p.destroyForcibly(); return true; }  // 直接杀进程',
      '    return false;',
      '}',
    ]],
  ['3.3 下载管线主体：yt-dlp 下载 + 进度解析 + ffmpeg 转码（DownloadJob.java）',
    '代码作用：整条管线的核心——先取元数据，再下载音频（stdout 正则逐行解析进度映射到 0-60%），ffmpeg 转 MP3 320k（60-75%），Feign 调用入库后正式落盘并回写最终地址。', [
      '// ② 下载（进度 0-60）：--newline 让 yt-dlp 每个进度块输出一行，便于逐行正则解析',
      'String outTpl = taskDir.resolve(task.getId() + "_temp.%(ext)s").toString();',
      'List<String> cmd = new ArrayList<>(List.of(ytdlp,',
      '        "-f", "bestaudio/best", "--extract-audio",   // 只取最优音频流',
      '        "--write-thumbnail", "--convert-thumbnails", "jpg",  // 顺带取封面',
      '        "--newline", "--no-playlist",',
      '        "-o", outTpl));',
      'cmd.addAll(netArgs.build(cleanUrl));                 // 反风控参数(UA/Referer/代理/buvid cookie)',
      'cmd.add(cleanUrl);',
      'ExecResult dl = executor.run(cmd, 20 * 60_000L,      // 下载超时 20 分钟',
      '        line -> {',
      '            Matcher m = PROGRESS.matcher(line);      // 匹配 "[download] 45.3%"',
      '            if (m.find()) {',
      '                int pct = (int) Double.parseDouble(m.group(1));',
      '                // 关键：把下载进度线性映射到总进度的 0~60 区间',
      '                tasks.progress(task.getId(), (int) (pct * 0.6), "正在下载音频… " + pct + "%");',
      '            }',
      '        }, TaskManager.cancelKey(task.getId())).get();  // cancelKey 绑定任务，取消时杀进程',
      '',
      '// ③ 转码 MP3 320k（进度 60-75）',
      'tasks.progress(task.getId(), 60, "正在转码 MP3…");',
      'Path mp3 = taskDir.resolve(task.getId() + "_out.mp3");',
      'executor.run(List.of(ffmpeg, "-y", "-i", tempFile.toString(),',
      '                "-codec:a", "libmp3lame", "-b:a", "320k", mp3.toString()),  // 320kbps 高音质',
      '        10 * 60_000L, null, TaskManager.cancelKey(task.getId())).get();',
      '',
      '// ⑤ Feign 入库：状态=1 审核中；失败回 PENDING 由任务引擎自动重试(≤3 次)',
      'tasks.progress(task.getId(), 80, "正在写入歌曲库…");',
      'song.put("fileUrl", storage.fileUrl("task", task.getId() + "_out.mp3"));  // 先指向临时文件',
      'song.put("status", 1);                               // 入库即"审核中"',
      'created = music.create(song);                        // Feign → Mod_music 服务',
      'if (created == null || !created.isOk()) { tasks.retryLater(task.getId(), retry + 1); return; }',
      '',
      '// ⑥ 正式落盘：task 临时目录 → music 正式目录，同名兜底加 -songId 防互相覆盖',
      'Path finalMp3 = storage.dir("music").resolve(stem + ".mp3");',
      'if (Files.exists(finalMp3))',
      '    finalMp3 = storage.dir("music").resolve(stem + "-" + songId + ".mp3");',
      'Files.move(mp3, finalMp3, REPLACE_EXISTING);',
      'music.updateFile(Map.of("songId", songId,',
      '        "fileUrl", storage.fileUrl("music", finalMp3.getFileName().toString())));  // 换成最终地址',
    ]],
  ['3.4 歌词三级降级 + 时间轴校准（MediaJobs.java / LyricAligner.java）',
    '代码作用：歌词获取按"在线词库 → 来源视频 CC 字幕 → 本地 whisper AI 转写"三级降级；命中在线同步歌词后，再用本地 whisper 转写结果做逐句校准，消除 B 站搬运版的剪辑/偏移。', [
      'public void lyricsFetch(MediaTask task) {',
      '    // 第 1 级：在线歌词库 LRCLIB（网络失败静默降级到下一级）',
      '    LrcSupport.OnlineMatch m = null;',
      '    try { m = LrcSupport.matchOnlineLyrics(title, artist, duration); }',
      '    catch (Exception e) { log.warn("lrclib match degraded: {}", e.getMessage()); }',
      '',
      '    if (m != null && m.syncedLyrics() != null) {         // 命中"带时间轴"的同步歌词',
      '        List<LrcSupport.LrcLine> lrc = LrcSupport.parseLrc(m.syncedLyrics());',
      '        List<LrcSupport.LrcLine> wav = transcribeForAlign(task, song);  // whisper 快速转写',
      '        LyricAligner.Aligned aligned = wav == null ? null',
      '                : LyricAligner.computeAlignedTimes(lrc, wav, duration);  // 关键：逐句校准',
      '        if (aligned != null) {',
      '            // 用校准后的时刻重写 LRC，并在备注里报告校准质量',
      '            content = LyricAligner.writeAlignedLyrics(m.syncedLyrics(), aligned.times(), aligned.median());',
      '            note = String.format("已逐句校准 %d/%d 句（整体偏移 %.1fs）", aligned.pairs(), lrc.size(), aligned.median());',
      '        } else { content = m.syncedLyrics(); note = "本地校准不可用，保留在线时间轴"; }',
      '        saveLyric(song, content);                        // 落盘 .lrc + Feign 回写 song 表',
      '        return;',
      '    }',
      '    if (m != null && m.plainLyrics() != null) { ... }    // 命中纯文本：本地识别拆句加时间轴',
      '    // 第 2 级：词库无命中 → 试来源视频的 CC 字幕（yt-dlp --write-subs，SRT→LRC 转换）',
      '    if (trySubtitleAsLyrics(task, song, sourceUrl)) return;',
      '    // 第 3 级：字幕也没有 → 本地 whisper AI 转写（-olrc 直接产出 LRC）',
      '    transcribe(task);',
      '}',
      '',
      '// 时间轴校准核心策略：区分"同版本"与"结构差异"，避免把好时间轴改坏',
      'boolean sameVersion = audioDuration != null && lastLrcTime != null',
      '        && Math.abs(audioDuration - lastLrcTime) <= 2;   // 时长差 ≤2s 判"同版本"',
      'List<Pair> pairs = pairMonotonic(lrc, wav, 10, 0.35);    // 单调配对：转写游标只前进',
      '                                                         // +文本相似度过滤，防副歌相似句错配',
      'if (sameVersion) {',
      '    // 同版本：whisper 逐句时刻噪声 > 在线轴自身误差，只做全局微移(±2.5s 封顶)，',
      '    // 不逐句改写——曾因单锚点抖动几秒把整段歌词推移(真实事故)',
      '    double shift = Math.max(-2.5, Math.min(2.5, median));',
      '} else {',
      '    // 结构差异(剪辑/搬运版)：配对 + 孤峰锚点剔除(真实剪辑差是阶跃, whisper 单句',
      '    // 抖动是孤峰——与两侧都差 >3s) → 锚点间线性插值偏移',
      '}',
    ]],
  ['3.5 求歌自动回填（DownloadJob.java）',
    '代码作用：下载任务 URL 上带 reqid 标记，入库成功后自动把对应求歌记录流转为"已入库"并关联歌曲 ID；回填失败不影响主流程（管理员可手动兜底）。', [
      'private void fulfillRequest(MediaTask task, Long songId, String url) {',
      '    Matcher m = REQID.matcher(url);                  // 正则 "[?&]reqid=(\\\\d+)"',
      '    if (!m.find()) return;                           // 非求歌发起的下载，跳过',
      '    SongRequest req = requestMapper.selectById(Long.parseLong(m.group(1)));',
      '    if (req == null || req.getStatus() != 0) return; // 仅"待处理"可回填',
      '    req.setStatus(1);                                // 0 待处理 → 1 已入库',
      '    req.setResultSongId(songId);                     // 关联入库后的歌曲 ID',
      '    req.setHandledBy(task.getOperator());            // 记录处理人',
      '    req.setHandledAt(LocalDateTime.now());',
      '    requestMapper.updateById(req);',
      '    // 回填失败只 log.warn 不抛出——不影响下载主流程，管理员可在管理页手动回填兜底',
      '}',
    ]],
  ['3.6 前端任务浮窗轮询（stores/tasks.js，Pinia）',
    '代码作用：前端统一管理所有媒体任务——1.5 秒轮询活跃任务、终态弹通知、5 秒后移除、刷新页面后从后端恢复任务列表继续跟踪。', [
      'const POLL_MS = 1500',
      'ensurePolling() {',
      '  if (this.timer || !this.hasActive) return',
      '  this.timer = setInterval(() => this.poll(), POLL_MS)   // 有活跃任务才开定时器',
      '},',
      'async poll() {',
      '  const pendings = this.active',
      '  if (!pendings.length) { this.stopPolling(); return }   // 全部终态则停表',
      '  // 关键：allSettled 并发轮询所有活跃任务，单个失败不影响其他',
      '  const results = await Promise.allSettled(',
      '    pendings.map((t) => api.mediaTask(t.taskId))',
      '  )',
      '  // 逐个回写 status / progress / stage / musicId',
      '  if (isTaskTerminal(old.status)) {',
      '    this.notify(old)                                     // 弹成功/失败通知',
      '    setTimeout(() => { this.tasks = this.tasks.filter(...) }, 5000)  // 终态保留 5 秒供查看',
      '  }',
      '},',
      'async cancel(taskId) {',
      '  await api.mediaCancel(taskId)                          // POST /media/task/{id}/cancel',
      '  const t = this.byId(taskId)',
      '  if (t) t.status = \'CANCELLED\'                          // 乐观更新，浮窗立即变灰',
      '}',
    ]],
];
{
  const parts = [];
  for (const [title, desc, lines] of CODE_SECTIONS) {
    parts.push(boldP(title), textP(desc), ...lines.map(codeP), codeP(''));
  }
  replaceParaContaining('[在此处粘贴你的核心代码]', parts.join(''), '核心代码占位符');
}

// ---------- ⑦ 运行效果：模板示例输出换成真实运行记录 ----------
const RUNLOG = [
  '👤 用户: 提交求歌《起风了》（我的求歌列表显示：待处理）',
  '',
  '🧑‍💼 管理员: 求歌处理tab → 搜索入库 → bilisearch 候选搜索"起风了"',
  '🔍 后端执行: yt-dlp -J --playlist-end 5 "bilisearch5:起风了" （约 4~8 秒返回 5 个候选）',
  '✅ 候选卡片展示: 标题/时长/封面，超 10 分钟的标红"疑似合集"',
  '',
  '🧑‍💼 管理员: 选定候选 → 开始下载',
  '📤 POST /api/v1/media/requests/12/download  {"url":"https://www.bilibili.com/video/BV..."}',
  '✅ 返回 taskId=101，URL 已追加 reqid=12 标记 → media_task 落库 PENDING',
  '',
  '🟡 [任务浮窗] 导入 · 排队中…            0%',
  '🟡 [任务浮窗] 导入 · 正在获取视频元数据…  1%',
  '🟡 [任务浮窗] 导入 · 正在下载音频… 35%   21%     ← stdout 正则 "[download] 35%" × 0.6',
  '🟡 [任务浮窗] 导入 · 正在下载音频… 100%  60%',
  '🟡 [任务浮窗] 导入 · 正在转码 MP3…       68%     ← ffmpeg libmp3lame -b:a 320k',
  '🟡 [任务浮窗] 导入 · 正在写入歌曲库…     80%     ← Feign → Mod_music, 状态=1 审核中',
  '🟡 [任务浮窗] 导入 · 正在生成歌词/指纹…  90%     ← 后置任务并行执行',
  '',
  '✅ [任务浮窗] 导入 · 完成                100%',
  '   ElMessage: 下载完成，求歌已自动回填',
  '',
  '📄 数据落点核验:',
  '   music/起风了.mp3          ← 320k MP3（临时文件已清理）',
  '   image/起风了.jpg          ← 封面',
  '   lyric/起风了.lrc          ← "已逐句校准 41/43 句（整体偏移 1.8s）"',
  '   song 表:                  状态=2 已发布(管理员操作直发), volume_gain=7.4dB',
  '   fp_hash 表:               +3200 行指纹',
  '   song_request 表:          状态=1 已入库, result_song_id=88',
  '',
  '👤 用户: 我的求歌列表刷新 → 《起风了》显示"已入库 #88"，点击即可播放',
];
{
  const t = xml.indexOf('👤');
  if (t < 0) throw new Error('未找到运行效果示例');
  const pStart = Math.max(xml.lastIndexOf('<w:p ', t), xml.lastIndexOf('<w:p>', t));
  const endText = xml.indexOf('广州今天晴天，气温17°C');
  const pEnd = xml.indexOf('</w:p>', endText) + '</w:p>'.length;
  xml = xml.slice(0, pStart) + RUNLOG.map(emojiP).join('') + xml.slice(pEnd);
}

// ---------- 写回并重打包 ----------
fs.writeFileSync(WORKDIR + '/word/document.xml', xml);
fs.rmSync(OUT, { force: true });
execSync(`"${TAR}" --format=zip -cf "${OUT}" "[Content_Types].xml" _rels docProps word`, { cwd: WORKDIR });
console.log('OK ->', OUT, fs.statSync(OUT).size, 'bytes');
