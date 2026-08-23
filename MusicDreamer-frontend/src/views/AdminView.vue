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
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="歌名" min-width="140" />
          <el-table-column prop="singerNickname" label="歌手" width="110" />
          <el-table-column label="来源" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.sourceUrl ? 'warning' : 'info'">{{ row.sourceUrl ? '链接导入' : '本地上传' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button size="small" type="success" @click="audit(row, true)">通过</el-button>
              <el-button size="small" type="danger" plain @click="audit(row, false)">驳回</el-button>
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
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="歌名" min-width="140" />
          <el-table-column prop="singerNickname" label="歌手" width="110" />
          <el-table-column label="播放" width="90" align="center">
            <template #default="{ row }">
              <span class="play-count">{{ row.playCount ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="收藏" width="70" align="center">
            <template #default="{ row }">{{ row.collectCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="(SONG_STATUS[row.status] || {}).type">{{ (SONG_STATUS[row.status] || {}).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="290" align="center">
            <template #default="{ row }">
              <el-button size="small" @click="edit(row)">编辑</el-button>
              <el-button size="small" type="primary" plain @click="lyric(row)">歌词</el-button>
              <el-button v-if="row.status === 2" size="small" type="danger" plain @click="takedown(row)">下架</el-button>
              <el-button v-if="row.status === 0" size="small" type="success" plain @click="relist(row)">重新上架</el-button>
              <el-button size="small" type="danger" @click="del(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="用户管理" name="users">
        <el-table :data="users" v-loading="loading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="username" label="用户名" width="130" />
          <el-table-column prop="nickname" label="昵称" width="130" />
          <el-table-column label="角色" width="100">
            <template #default="{ row }">{{ roleLabel(row.role) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button size="small" :type="row.status === 1 ? 'danger' : 'success'" plain @click="toggleUser(row)">
                {{ row.status === 1 ? '禁用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="歌手认证" name="singers">
        <el-table :data="applications" v-loading="loading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="username" label="申请人" width="120" />
          <el-table-column prop="realName" label="真实姓名" width="110" />
          <el-table-column prop="createTime" label="申请时间" width="160">
            <template #default="{ row }">{{ fmtTime(row.createTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button size="small" type="success" @click="singerAudit(row, true)">通过</el-button>
              <el-button size="small" type="danger" plain @click="singerAudit(row, false)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!applications.length && !loading" description="没有待审核申请" />
      </el-tab-pane>

      <el-tab-pane label="举报处理" name="reports">
        <el-table :data="reports" v-loading="loading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="对象" width="110">
            <template #default="{ row }">{{ targetTypeLabel(row.targetType) }}#{{ row.targetId }}</template>
          </el-table-column>
          <el-table-column label="原因" width="110">
            <template #default="{ row }">{{ reasonLabel(row.reason) }}</template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="160" />
          <el-table-column label="操作" width="240" align="center">
            <template #default="{ row }">
              <template v-if="row.status === 1">
                <el-button size="small" type="success" @click="handleReport(row, true)">标记处理</el-button>
                <el-button v-if="row.targetType === 1" size="small" type="danger" plain
                  @click="handleReport(row, true, 'takedown')">下架歌曲</el-button>
                <el-button size="small" plain @click="handleReport(row, false)">驳回</el-button>
              </template>
              <el-tag v-else size="small">{{ row.status === 2 ? '已处理' : '已驳回' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="工具与模型" name="tools">
        <el-card class="tools-card">
          <template #header>媒体工具（没有就下载，有就更新；全部安装到 tools/bin/）</template>
          <el-table :data="toolsList">
            <el-table-column prop="name" label="工具" width="120" />
            <el-table-column prop="version" label="本地版本" min-width="140" />
            <el-table-column prop="latest" label="最新版本" min-width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.alive ? 'success' : 'danger'">{{ row.alive ? '健康' : '不可用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" align="center">
              <template #default="{ row }">
                <el-button size="small" :type="row.alive ? 'default' : 'primary'"
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
      </el-tab-pane>
    </el-tabs>

    <ReasonDialog v-model="reasonVisible" :title="reasonTitle" @confirm="onReasonConfirm" />

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
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { message, confirm } from '../utils/feedback'
import api from '../api'
import { listOf, SONG_STATUS, fmtTime, resolveFileUrl } from '../utils'
import SongEditDialog from '../components/SongEditDialog.vue'
import ReasonDialog from '../components/ReasonDialog.vue'

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
    if (tab.value === 'tools') {
      toolsList.value = listOf(await api.toolsStatus())
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

// 工具安装/更新进度：提交任务后轮询到结束，按钮上直接显示阶段与百分比
const toolInstall = ref({ running: false, name: '', stage: '' })
let toolInstallTimer = null

function stopToolInstall() {
  if (toolInstallTimer) clearInterval(toolInstallTimer)
  toolInstallTimer = null
  toolInstall.value = { running: false, name: '', stage: '' }
}

async function installTool(row) {
  const r = await api.toolInstall(row.name)
  if (!r.data || !r.data.taskId) return
  toolInstall.value = { running: true, name: row.name, stage: '已提交…' }
  stopToolInstall()
  toolInstallTimer = setInterval(async () => {
    try {
      const t = (await api.mediaTask(r.data.taskId)).data || {}
      toolInstall.value.stage = t.stage || toolInstall.value.stage
      if (t.status === 'SUCCESS') {
        stopToolInstall()
        message.success(t.error || t.stage || (row.name + ' 已就绪'))
        load()
      } else if (t.status === 'FAILED' || t.status === 'CANCELLED') {
        stopToolInstall()
        message.error('安装失败：' + (t.error || t.stage || '未知原因'))
      }
    } catch (e) { /* 轮询失败静默等下一轮 */ }
  }, 1500)
}

onUnmounted(stopToolInstall)

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
</style>
