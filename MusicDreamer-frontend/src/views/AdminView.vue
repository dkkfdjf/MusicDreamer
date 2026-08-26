<template>
  <div class="admin">
    <div class="page-head">
      <div>
        <div class="eyebrow">Console · 管理后台</div>
        <h1>管理后台</h1>
      </div>
    </div>
    <el-tabs v-model="tab" tab-position="left" @tab-change="load">
      <el-tab-pane label="歌曲审核" name="audit">
        <el-table :data="auditSongs" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="歌名" min-width="200" />
          <el-table-column prop="singerNickname" label="歌手" width="130" />
          <el-table-column label="来源" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.sourceUrl ? 'warning' : 'info'">{{ row.sourceUrl ? '链接导入' : '本地上传' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="230" align="center">
            <template #default="{ row }">
              <el-button type="success" @click="audit(row, true)">通过</el-button>
              <el-button type="danger" plain @click="audit(row, false)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!auditSongs.length && !loading" description="没有待审核歌曲" />
      </el-tab-pane>

      <el-tab-pane label="全量歌曲" name="songs">
        <div class="song-stats">
          <span>共 <b>{{ songTotal }}</b> 首</span>
          <span class="divider">·</span>
          <span>累计播放 <b class="play-count">{{ totalPlays }}</b> 次</span>
          <span class="hint">（飙升榜/热歌榜即由播放数据驱动）</span>
        </div>
        <el-table :data="allSongs" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="歌名" min-width="200" />
          <el-table-column prop="singerNickname" label="歌手" width="130" />
          <el-table-column label="播放" width="100" align="center">
            <template #default="{ row }">
              <span class="play-count">{{ row.playCount ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="收藏" width="80" align="center">
            <template #default="{ row }">{{ row.collectCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="(SONG_STATUS[row.status] || {}).type">{{ (SONG_STATUS[row.status] || {}).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="400" align="center">
            <template #default="{ row }">
              <el-button @click="edit(row)">编辑</el-button>
              <el-button type="primary" plain @click="lyric(row)">歌词</el-button>
              <el-button v-if="row.status === 2" type="danger" plain @click="takedown(row)">下架</el-button>
              <el-button v-if="row.status === 0" type="success" plain @click="relist(row)">重新上架</el-button>
              <el-button type="danger" @click="del(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="用户管理" name="users">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px">
          <el-button type="primary" @click="openCreateUser">新增用户</el-button>
        </div>
        <el-table :data="users" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="username" label="用户名" width="150" />
          <el-table-column prop="nickname" label="昵称" width="150" />
          <el-table-column label="角色" width="110">
            <template #default="{ row }">{{ roleLabel(row.role) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ row }">
              <el-button :type="row.status === 1 ? 'danger' : 'success'" plain @click="toggleUser(row)">
                {{ row.status === 1 ? '禁用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="歌手认证" name="singers">
        <el-table :data="applications" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="username" label="申请人" width="140" />
          <el-table-column prop="realName" label="真实姓名" width="130" />
          <el-table-column prop="createTime" label="申请时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.createTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="230" align="center">
            <template #default="{ row }">
              <el-button type="success" @click="singerAudit(row, true)">通过</el-button>
              <el-button type="danger" plain @click="singerAudit(row, false)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!applications.length && !loading" description="没有待审核申请" />
      </el-tab-pane>

      <el-tab-pane label="举报处理" name="reports">
        <el-table :data="reports" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="对象" width="120">
            <template #default="{ row }">{{ targetTypeLabel(row.targetType) }}#{{ row.targetId }}</template>
          </el-table-column>
          <el-table-column label="原因" width="120">
            <template #default="{ row }">{{ reasonLabel(row.reason) }}</template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="200" />
          <el-table-column label="操作" width="340" align="center">
            <template #default="{ row }">
              <template v-if="row.status === 1">
                <el-button type="success" @click="handleReport(row, true)">标记处理</el-button>
                <el-button v-if="row.targetType === 1" type="danger" plain
                  @click="handleReport(row, true, 'takedown')">下架歌曲</el-button>
                <el-button plain @click="handleReport(row, false)">驳回</el-button>
              </template>
              <el-tag v-else size="small">{{ row.status === 2 ? '已处理' : '已驳回' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="求歌处理" name="requests">
        <el-table :data="songRequests" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="申请人" width="150">
            <template #default="{ row }">{{ reqUserName(row.userId) }}</template>
          </el-table-column>
          <el-table-column label="歌曲" min-width="200">
            <template #default="{ row }">
              <span class="req-title">{{ row.title }}</span>
              <span v-if="row.artist" class="req-artist">{{ row.artist }}</span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="100">
            <template #default="{ row }">{{ reqSourceLabel(row.source) }}</template>
          </el-table-column>
          <el-table-column label="提交时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.status === 0 ? 'warning' : (row.status === 1 ? 'success' : 'info')">
                {{ reqStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="300" align="center">
            <template #default="{ row }">
              <template v-if="row.status === 0">
                <el-button type="primary" @click="openReqSearch(row)">搜索入库</el-button>
                <el-button type="danger" plain @click="rejectRequest(row)">拒绝</el-button>
              </template>
              <span v-else-if="row.status === 1" class="req-done">歌曲 #{{ row.resultSongId }}</span>
              <el-tooltip v-else :content="row.rejectReason || '未填理由'" placement="top">
                <span class="req-done">{{ row.rejectReason || '已拒绝' }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="工具与模型" name="tools">
        <el-card class="tools-card">
          <template #header>媒体工具（没有就下载，有就更新；全部安装到 tools/bin/）</template>
          <el-table :data="toolsList">
            <el-table-column label="工具" width="170">
              <template #default="{ row }">
                <span class="tool-name">{{ row.name }}</span>
                <a class="tool-link" :href="TOOL_LINKS[row.name]" target="_blank" rel="noopener"
                  title="跳转开源主页">开源</a>
              </template>
            </el-table-column>
            <el-table-column label="本地版本" min-width="200">
              <template #default="{ row }">
                <!-- whisper 构建无版本号，显示版本没有意义，只看健康状态 -->
                <span v-if="row.name === 'whisper'" class="tool-dash">—</span>
                <span v-else>{{ row.version || '未安装' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.alive ? 'success' : 'danger'">{{ row.alive ? '健康' : '不可用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" align="center">
              <template #default="{ row }">
                <el-button :type="row.alive ? 'default' : 'primary'"
                  :loading="toolInstall.running && toolInstall.name === row.name"
                  @click="installTool(row)">
                  <span v-if="toolInstall.running && toolInstall.name === row.name">
                    {{ toolInstall.stage || '进行中…' }}
                  </span>
                  <span v-else>{{ row.alive ? '更新' : '下载' }}</span>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="tools-card">
          <template #header>whisper 转写模型（ggml 格式，存放于 data/models/）</template>
          <el-table :data="modelsList">
            <el-table-column label="模型" width="230">
              <template #default="{ row }">
                <span class="tool-name">ggml-{{ row.key }}.bin</span>
                <a class="tool-link" :href="MODEL_LINK" target="_blank" rel="noopener"
                  title="跳转模型开源页">开源</a>
              </template>
            </el-table-column>
            <el-table-column prop="label" label="规格" min-width="180" />
            <el-table-column prop="sizeText" label="大小" width="130" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.isCurrent ? 'success' : (row.downloaded ? 'info' : 'danger')">
                  {{ row.isCurrent ? '使用中' : (row.downloaded ? '已下载' : '未下载') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" align="center">
              <template #default="{ row }">
                <el-button v-if="!row.downloaded" type="primary"
                  :loading="toolInstall.running && toolInstall.name === row.key"
                  @click="downloadModel(row)">
                  <span v-if="toolInstall.running && toolInstall.name === row.key">
                    {{ toolInstall.stage || '进行中…' }}
                  </span>
                  <span v-else>下载</span>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="tools-card">
          <template #header>听歌识曲指纹库（歌曲入库自动生成；识别不准或曲库较大时可全量重建）</template>
          <div class="fp-row">
            <div class="fp-stat">已索引 <b>{{ fp.songs }}</b> 首</div>
            <el-tag v-if="fp.running" type="warning">重建中 {{ fp.done ?? 0 }} / {{ fp.total ?? '?' }}</el-tag>
            <el-tag v-else :type="fp.songs > 0 ? 'success' : 'info'">
              {{ fp.songs > 0 ? '就绪' : '空库（重建后才能识曲）' }}
            </el-tag>
            <el-tag :type="fp.external?.enabled ? 'success' : 'info'" title="本地识别不到时的第三方兜底，在 data/acrcloud.properties 配置">
              外置识别{{ fp.external?.enabled ? '已启用' : '未配置' }}
            </el-tag>
            <el-button size="small" :disabled="fp.running" @click="rebuildFp">全量重建</el-button>
          </div>
          <div class="fp-hint">重建遍历曲库逐首解码生成指纹（约 0.6 秒/首），后台线程执行不阻塞服务</div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <ReasonDialog v-model="reasonVisible" :title="reasonTitle" @confirm="onReasonConfirm" />

    <!-- 求歌搜索入库：bilisearch 候选卡片，选定即走现有下载管线（完成后自动回填状态） -->
    <el-drawer v-model="reqDrawer" size="560px"
      :title="reqCurrent ? `搜索入库：${reqCurrent.title}` : '搜索入库'">
      <div class="req-search-bar">
        <el-input v-model="reqKw" placeholder="歌名 歌手" clearable @keyup.enter="doReqSearch" />
        <el-button type="primary" :loading="reqSearching" @click="doReqSearch">搜索</el-button>
      </div>
      <div class="req-tip">B 站搜索前 5 条；优先选时长完整、官方/同名音频</div>
      <div v-loading="reqSearching" class="req-cands">
        <div v-for="c in reqCandidates" :key="c.url" class="req-card" @click="pickCandidate(c)">
          <img v-if="c.cover" class="req-cover" :src="c.cover" loading="lazy"
            referrerpolicy="no-referrer" alt="" />
          <div v-else class="req-cover req-cover-none">♪</div>
          <div class="req-info">
            <div class="req-c-title">{{ c.title }}</div>
            <div class="req-c-meta">
              <span v-if="c.duration">{{ fmtDuration(c.duration) }}</span>
              <span>{{ c.uploader || '未知UP' }}</span>
            </div>
          </div>
        </div>
        <el-empty v-if="!reqSearching && searched && !reqCandidates.length"
          description="没搜到，换个关键词试试" />
      </div>
    </el-drawer>

    <SongEditDialog v-model="editVisible" :song="editSong" @saved="load" />

    <el-dialog v-model="lyricVisible" title="歌词（支持截图 OCR 识别）" width="560px">
      <el-upload :auto-upload="false" :limit="1" :on-change="onOcrImage" accept="image/*" :show-file-list="false">
        <el-button :loading="ocrRunning">选歌词截图自动识别（Windows OCR）</el-button>
      </el-upload>
      <el-input v-model="lyricText" type="textarea" :rows="12" style="margin-top:10px"
        placeholder="粘贴歌词文本，或选截图自动识别；支持 LRC 时间轴格式 [mm:ss.xx] 歌词" />
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px">
        保存后生成 .lrc 文件并绑定到该歌曲，播放页与桌面歌词即可展示
      </div>
      <template #footer>
        <el-button @click="lyricVisible = false">取消</el-button>
        <el-button type="primary" :loading="lyricSaving" @click="saveLyric">保存歌词</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createUserVisible" title="新增用户" width="440px">
      <el-form :model="createUserForm" label-width="64px">
        <el-form-item label="用户名" required>
          <el-input v-model="createUserForm.username" placeholder="3-50 字符" maxlength="50" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="createUserForm.password" type="password" show-password placeholder="6-64 位" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="createUserForm.nickname" placeholder="留空则同用户名" maxlength="50" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createUserForm.email" placeholder="可选，留空自动占位" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="createUserForm.role" style="width: 100%">
            <el-option label="听众" :value="0" />
            <el-option label="歌手（直接认证通过）" :value="1" />
            <el-option label="管理员" :value="2" />
          </el-select>
        </el-form-item>
      </el-form>
      <div style="font-size:12px;color:var(--text-muted)">
        管理员创建的账号跳过邮件激活、直接可用；歌手角色会同步补写歌手资料
      </div>
      <template #footer>
        <el-button @click="createUserVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingUser" @click="submitCreateUser">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { message, confirm } from '../utils/feedback'
import api from '../api'
import { listOf, SONG_STATUS, fmtTime, resolveFileUrl } from '../utils'
import SongEditDialog from '../components/SongEditDialog.vue'
import ReasonDialog from '../components/ReasonDialog.vue'
import { useTaskStore } from '../stores/tasks'

const tab = ref('audit')
const loading = ref(false)
const auditSongs = ref([])
const allSongs = ref([])
const songTotal = ref(0)
const totalPlays = ref(0)
const users = ref([])
const applications = ref([])
const reports = ref([])
const toolsList = ref([])
const modelsList = ref([])
const songRequests = ref([])
const taskStore = useTaskStore()

// 工具与模型的开源主页（管理页直接跳转，代替原来的"最新版本"比对）
const TOOL_LINKS = {
  'yt-dlp': 'https://github.com/yt-dlp/yt-dlp',
  'ffmpeg': 'https://github.com/FFmpeg/FFmpeg',
  'ffprobe': 'https://github.com/FFmpeg/FFmpeg',
  'whisper': 'https://github.com/ggml-org/whisper.cpp'
}
const MODEL_LINK = 'https://huggingface.co/ggerganov/whisper.cpp'

const editVisible = ref(false)
const editSong = ref(null)

function edit(row) {
  editSong.value = row
  editVisible.value = true
}

const lyricVisible = ref(false)
const lyricText = ref('')
const lyricSong = ref(null)
const lyricSaving = ref(false)
const ocrRunning = ref(false)

async function lyric(row) {
  lyricSong.value = row
  lyricText.value = ''
  lyricVisible.value = true
  // 已有歌词先拉回编辑
  try {
    const d = await api.songDetail(row.id)
    if (d && d.lyricUrl) {
      const res = await fetch(resolveFileUrl(d.lyricUrl))
      if (res.ok) lyricText.value = await res.text()
    }
  } catch (e) { /* 无歌词忽略 */ }
}

async function onOcrImage(file) {
  if (!file.raw) return
  ocrRunning.value = true
  try {
    const up = await api.uploadImage(file.raw)
    const data = await api.mediaOcr(up.url)
    lyricText.value = (lyricText.value ? lyricText.value + '\n' : '') + (data.text || '')
    message.success('OCR 识别完成，请校对后保存')
  } finally {
    ocrRunning.value = false
  }
}

async function saveLyric() {
  if (!lyricText.value.trim()) return message.warning('歌词内容为空')
  lyricSaving.value = true
  try {
    const f = new File([lyricText.value], `song-${lyricSong.value.id}.lrc`, { type: 'text/plain' })
    const up = await api.uploadLyric(f)
    await api.songEdit(lyricSong.value.id, { lyricUrl: up.url })
    message.success('歌词已保存')
    lyricVisible.value = false
  } finally {
    lyricSaving.value = false
  }
}

const reasonVisible = ref(false)
const reasonTitle = ref('')
let reasonAction = null

function askReason(title, fn) {
  reasonTitle.value = title
  reasonAction = fn
  reasonVisible.value = true
}
function onReasonConfirm(reason) {
  if (reasonAction) reasonAction(reason || '')
}

const roleLabel = (r) => ({ 0: '用户', 1: '歌手', 2: '管理员' }[r] || r)
const targetTypeLabel = (t) => ({ 1: '歌曲', 2: '评论', 3: '歌单', 4: '动态' }[t] || t)
const reasonLabel = (r) => ({ 1: '侵权', 2: '违规内容', 3: '垃圾信息', 4: '其他' }[r] || r)

// ---------- 求歌处理（听歌识曲一期） ----------
const reqSourceLabel = (s) => ({ 0: '手动', 1: '识曲', 2: '外置识别' }[s] ?? s)
const reqStatusLabel = (s) => ({ 0: '待处理', 1: '已入库', 2: '已拒绝' }[s] ?? s)
const reqUserName = (id) => {
  const u = users.value.find((x) => x.id === id)
  return u ? (u.nickname || u.username) : `用户#${id}`
}
const fmtDuration = (sec) => {
  const s = Math.round(Number(sec) || 0)
  return s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : ''
}

function rejectRequest(row) {
  askReason(`拒绝求歌《${row.title}》`, async (reason) => {
    await api.requestReject(row.id, reason)
    message.success('已拒绝')
    load()
  })
}

// 搜索入库抽屉：候选来自 bilisearch（yt-dlp --flat-playlist，只拉元数据）
const reqDrawer = ref(false)
const reqCurrent = ref(null)
const reqKw = ref('')
const reqSearching = ref(false)
const reqCandidates = ref([])
const searched = ref(false)

function openReqSearch(row) {
  reqCurrent.value = row
  reqKw.value = [row.title, row.artist].filter(Boolean).join(' ').trim()
  reqCandidates.value = []
  searched.value = false
  reqDrawer.value = true
  doReqSearch()
}

async function doReqSearch() {
  const kw = (reqKw.value || '').trim()
  if (!kw) return message.warning('请输入关键词')
  reqSearching.value = true
  try {
    reqCandidates.value = listOf(await api.recognizeSearch(kw))
    searched.value = true
  } finally {
    reqSearching.value = false
  }
}

async function pickCandidate(c) {
  try {
    await confirm(
      `将下载《${c.title}》的音频并入库，完成后自动回填求歌状态。歌名等信息之后可在「全量歌曲」里编辑。`,
      { title: '下载入库', okText: '开始下载' }
    )
  } catch (e) {
    return
  }
  try {
    const data = await api.requestDownload(reqCurrent.value.id, c.url)
    taskStore.track(data.taskId, 'DOWNLOAD')
    message.success('已开始下载，完成后求歌状态自动回填')
    reqDrawer.value = false
  } catch (e) {
    /* api 层已提示 */
  }
}

async function load() {
  loading.value = true
  try {
    if (tab.value === 'audit') auditSongs.value = listOf(await api.songAdminList({ status: 1, page: 1, size: 50 }))
    if (tab.value === 'songs') {
      const r = await api.songAdminList({ page: 1, size: 100 })
      allSongs.value = listOf(r)
      songTotal.value = r?.total ?? 0
      totalPlays.value = r?.totalPlays ?? 0
    }
    if (tab.value === 'users') users.value = listOf(await api.userList({ page: 1, size: 100 }))
    if (tab.value === 'singers') applications.value = listOf(await api.singerApplications({ status: 1 }))
    if (tab.value === 'reports') reports.value = listOf(await api.reportList({ status: 1, page: 1, size: 50 }))
    if (tab.value === 'requests') {
      users.value = listOf(await api.userList({ page: 1, size: 100 }))
      songRequests.value = listOf(await api.requestList())
    }
    if (tab.value === 'tools') {
      toolsList.value = listOf(await api.toolsStatus())
      modelsList.value = listOf(await api.toolsModels())
      loadFp()
    }
  } finally {
    loading.value = false
  }
}

async function audit(row, pass) {
  if (pass) {
    await api.songAudit({ songId: row.id, pass: true })
    message.success('已通过，歌曲发布')
  } else {
    askReason('驳回原因', async (reason) => {
      await api.songAudit({ songId: row.id, pass: false, rejectReason: reason })
      message.success('已驳回')
      load()
    })
    return
  }
  load()
}

function takedown(row) {
  askReason('下架原因', async (reason) => {
    await api.songTakedown(row.id, reason)
    message.success('已下架')
    load()
  })
}

async function relist(row) {
  await api.songRelist(row.id)
  message.success('已重新上架')
  load()
}

async function del(row) {
  await confirm(`删除《${row.name}》将连带版本、评论、收藏，不可恢复，确定？`, { title: '删除歌曲' })
  await api.songDelete(row.id)
  message.success('已删除')
  load()
}

async function toggleUser(row) {
  await api.setUserStatus({ userId: row.id, status: row.status === 1 ? 0 : 1 })
  message.success('已更新')
  load()
}

const createUserVisible = ref(false)
const creatingUser = ref(false)
const createUserForm = ref({ username: '', password: '', nickname: '', email: '', role: 0 })

function openCreateUser() {
  createUserForm.value = { username: '', password: '', nickname: '', email: '', role: 0 }
  createUserVisible.value = true
}

async function submitCreateUser() {
  const f = createUserForm.value
  if (!f.username || f.username.trim().length < 3) return message.warning('用户名至少 3 个字符')
  if (!f.password || f.password.length < 6) return message.warning('密码至少 6 位')
  creatingUser.value = true
  try {
    await api.createUser({
      username: f.username.trim(),
      password: f.password,
      nickname: f.nickname.trim() || undefined,
      email: f.email.trim() || undefined,
      role: f.role
    })
    message.success('账号已创建，可直接登录')
    createUserVisible.value = false
    load()
  } finally {
    creatingUser.value = false
  }
}

async function singerAudit(row, pass) {
  if (pass) {
    await api.singerAudit({ applicationId: row.id, pass: true })
    message.success('已通过，申请人升级为歌手')
  } else {
    askReason('驳回原因', async (reason) => {
      await api.singerAudit({ applicationId: row.id, pass: false, rejectReason: reason })
      message.success('已驳回')
      load()
    })
    return
  }
  load()
}

async function handleReport(row, pass, action) {
  await api.reportHandle({ id: row.id, pass, action: action || '', handleResult: action === 'takedown' ? '核实违规，已下架' : '' })
  message.success('已处理')
  load()
}

// 工具/模型安装进度：提交任务后轮询到结束，按钮上直接显示阶段
const toolInstall = ref({ running: false, name: '', stage: '' })
let toolInstallTimer = null

function stopToolInstall() {
  if (toolInstallTimer) clearInterval(toolInstallTimer)
  toolInstallTimer = null
  toolInstall.value = { running: false, name: '', stage: '' }
}

function pollInstallTask(taskId, name, doneMsg) {
  toolInstall.value = { running: true, name, stage: '已提交…' }
  stopToolInstall()
  toolInstallTimer = setInterval(async () => {
    try {
      const t = (await api.mediaTask(taskId)).data || {}
      toolInstall.value.stage = t.stage || toolInstall.value.stage
      if (t.status === 'SUCCESS') {
        stopToolInstall()
        message.success(t.stage || doneMsg)
        load()
      } else if (t.status === 'FAILED' || t.status === 'CANCELLED') {
        stopToolInstall()
        message.error('安装失败：' + (t.error || t.stage || '未知原因'))
      }
    } catch (e) { /* 轮询失败静默等下一轮 */ }
  }, 1500)
}

async function installTool(row) {
  const r = await api.toolInstall(row.name)
  if (!r.data || !r.data.taskId) return
  pollInstallTask(r.data.taskId, row.name, row.name + ' 已就绪')
}

async function downloadModel(row) {
  const r = await api.modelDownload(row.key)
  if (!r.data || !r.data.taskId) return
  pollInstallTask(r.data.taskId, row.key, '模型 ' + row.key + ' 已就绪')
}

// ---------- 听歌识曲指纹库 ----------
const fp = ref({ songs: 0, running: false })
let fpTimer = null

async function loadFp() {
  try {
    fp.value = await api.fingerprintStatus()
  } catch (e) { /* 服务未就绪等：静默 */ }
  if (fp.value.running && !fpTimer) {
    fpTimer = setInterval(async () => {
      await loadFp()
      if (!fp.value.running) {
        clearInterval(fpTimer)
        fpTimer = null
        message.success('指纹库重建完成')
      }
    }, 2000)
  }
}

async function rebuildFp() {
  await api.fingerprintRebuild()
  message.success('已开始后台重建')
  loadFp()
}

onUnmounted(() => {
  stopToolInstall()
  if (fpTimer) clearInterval(fpTimer)
})

onMounted(load)
</script>

<style scoped>
.admin { min-height: 60vh; }
.tools-card { margin-bottom: 14px; }
.play-count { font-family: var(--font-mono); font-weight: 700; color: var(--accent); }
.song-stats { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; font-size: 13px; color: var(--text-muted); }
.song-stats b { font-family: var(--font-mono); color: var(--text); }
.song-stats .divider { opacity: 0.5; }
.song-stats .hint { font-size: 12px; opacity: 0.65; }

/* 表格整体放大：Element 默认单元格偏紧凑，管理后台信息密度低，放宽行高与字号 */
.admin :deep(.el-table) { font-size: 13.5px; }
.admin :deep(.el-table .el-table__cell) { padding: 11px 0; }
.admin :deep(.el-table .cell) { padding: 0 14px; line-height: 1.5; }

.tool-name { font-weight: 600; margin-right: 8px; }
.tool-link {
  font-size: 12px;
  color: var(--cyan, #0699b8);
  text-decoration: none;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}
.tool-link:hover { opacity: 0.72; }
.tool-dash { color: var(--text-faint, #b0a89c); }
.fp-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.fp-stat { font-size: 13.5px; }
.fp-stat b { font-size: 16px; }
.fp-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-faint, #b0a89c);
}

/* 求歌处理 */
.req-title { font-weight: 600; margin-right: 8px; }
.req-artist { color: var(--text-muted, #8a8378); }
.req-done { color: var(--text-muted, #8a8378); font-size: 13px; }
.req-search-bar { display: flex; gap: 10px; margin-bottom: 6px; }
.req-tip { font-size: 12px; color: var(--text-muted, #8a8378); margin-bottom: 12px; }
.req-cands { display: flex; flex-direction: column; gap: 10px; min-height: 120px; }
.req-card {
  display: flex;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--border, rgba(127, 127, 127, 0.18));
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.req-card:hover { border-color: var(--accent, #4fd1c5); }
.req-cover { width: 96px; height: 60px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.req-cover-none {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint, #b0a89c);
  background: rgba(127, 127, 127, 0.12);
  font-size: 20px;
}
.req-info { min-width: 0; }
.req-c-title {
  font-size: 13.5px;
  line-height: 1.4;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.req-c-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted, #8a8378); }
</style>
