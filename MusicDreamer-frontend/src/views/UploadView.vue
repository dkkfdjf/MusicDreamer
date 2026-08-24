<template>
  <div class="upload">
    <div class="page-head">
      <div>
        <div class="eyebrow">Studio · 上传中心</div>
        <h1>上传中心</h1>
      </div>
    </div>
    <el-tabs v-model="tab">
      <!-- 本地文件上传 -->
      <el-tab-pane label="本地上传" name="file">
        <el-card>
          <el-form :model="form" label-width="100px" class="upload-form">
            <el-form-item label="音频文件">
              <el-upload :auto-upload="false" :limit="1" :on-change="onFile" accept=".mp3,.flac,.aac"
                :file-list="fileList">
                <el-button type="primary">选择音频（MP3/FLAC/AAC ≤ 50MB）</el-button>
              </el-upload>
            </el-form-item>
            <el-form-item label="歌名"><el-input v-model="form.name" style="width:320px" /></el-form-item>
            <el-form-item v-if="isAdmin" label="歌手名">
              <el-input v-model="form.singerName" style="width:320px" placeholder="导入他人作品时填原始歌手名，留空则用你的昵称" />
            </el-form-item>
            <el-form-item label="专辑"><el-input v-model="form.album" style="width:320px" /></el-form-item>
            <el-form-item label="风格">
              <el-select v-model="form.style" style="width:180px">
                <el-option v-for="s in STYLES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item label="语言">
              <el-select v-model="form.language" style="width:180px">
                <el-option v-for="l in LANGUAGES" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
            <el-form-item label="封面图片">
              <el-upload :auto-upload="false" :limit="1" :on-change="onCover" accept="image/*" :file-list="coverList">
                <el-button>选择封面（可选，提升列表观感）</el-button>
              </el-upload>
            </el-form-item>
            <el-form-item label="歌词文件">
              <el-upload :auto-upload="false" :limit="1" :on-change="onLyric" accept=".lrc,.txt" :file-list="lyricList">
                <el-button>选择歌词（可选，LRC 带时间轴）</el-button>
              </el-upload>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="uploading" @click="submitFile">提交（进入审核）</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 链接导入（媒体任务） -->
      <el-tab-pane label="链接导入" name="link">
        <el-card>
          <el-form label-width="100px">
            <el-form-item label="来源链接">
              <el-input v-model="link.url" placeholder="支持 B 站 / YouTube 视频链接" style="width:560px" />
            </el-form-item>
            <el-form-item v-if="isAdmin" label="歌手名">
              <el-input v-model="link.singerName" style="width:320px" placeholder="导入成功后自动回填到歌曲（留空用你的昵称）" />
            </el-form-item>
            <el-form-item label="选项">
              <el-checkbox v-model="link.wantSubtitle">尝试下载字幕</el-checkbox>
              <el-checkbox v-model="link.wantTranscribe">自动获取歌词（在线匹配优先，无命中时本地 AI 转写）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :disabled="!link.url || running" @click="startDownload">开始导入</el-button>
              <el-button v-if="running" type="danger" plain @click="cancel">取消任务</el-button>
            </el-form-item>
          </el-form>

          <div v-if="task" class="task-box">
            <div class="task-line">
              <el-tag :type="taskTag">{{ task.status }}</el-tag>
              <span class="stage">{{ task.stage || '排队中…' }}</span>
            </div>
            <el-progress :percentage="Number(task.progress) || 0" :status="task.status === 'SUCCESS' ? 'success' : undefined" />
            <div v-if="task.error" class="task-error">错误：{{ task.error }}</div>
            <el-button v-if="task.status === 'SUCCESS' && task.musicId" size="small" type="success"
              @click="$router.push('/')">
              已入库，去首页看看
            </el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 我的歌曲 -->
      <el-tab-pane label="我的歌曲" name="mine">
        <el-table :data="mine" v-loading="mineLoading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="歌名" min-width="160" />
          <el-table-column label="播放" width="80" align="center">
            <template #default="{ row }">{{ row.playCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="(SONG_STATUS[row.status] || {}).type">{{ (SONG_STATUS[row.status] || {}).label || row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="驳回/下架原因" min-width="200">
            <template #default="{ row }">
              <span class="sub">{{ row.rejectReason || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ row }">
              <el-button v-if="row.status === 1 && row.rejectReason" size="small" type="warning"
                @click="resubmit(row)">重新提交</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from '../utils/feedback'
import api from '../api'
import { listOf, SONG_STATUS, STYLES, LANGUAGES, isTaskTerminal } from '../utils'
import { useUserStore } from '../stores/user'
import { useTaskStore } from '../stores/tasks'

const userStore = useUserStore()
const isAdmin = userStore.role === 2
const tab = ref('file')
const form = ref({ name: '', album: '', style: '流行', language: '国语', singerName: '' })
const fileList = ref([])
const picked = ref(null)
const coverList = ref([])
const lyricList = ref([])
const pickedCover = ref(null)
const pickedLyric = ref(null)
const uploading = ref(false)

// 自动获取歌词默认开启：在线歌词库优先，无命中本地 AI 转写
const link = ref({ url: '', singerName: '', wantSubtitle: true, wantTranscribe: true })
const task = ref(null)
let singerApplied = false
const taskStore = useTaskStore()
// 任务轮询在全局 store（切页后仍跟踪，右下角悬浮指示器可见），此处只引用展示
const running = computed(() => !!task.value && !isTaskTerminal(task.value.status))

// 任务结束时回填歌手名（管理员导入他人作品的场景）
watch(() => task.value && task.value.status, (status) => {
  if (!status || !isTaskTerminal(status)) return
  const name = (link.value.singerName || '').trim()
  if (status === 'SUCCESS' && task.value.musicId && name && !singerApplied) {
    singerApplied = true
    api.songEdit(task.value.musicId, { singerName: name })
      .then(() => message.success(`歌手名已回填：${name}`))
      .catch(() => message.warning('歌手名回填失败，可在首页编辑歌曲信息补填'))
  }
  loadMine()
})

const mine = ref([])
const mineLoading = ref(false)

function onFile(file) {
  if (file.raw && file.raw.size > 50 * 1024 * 1024) {
    message.error('文件超过 50MB 限制')
    fileList.value = []
    return
  }
  picked.value = file.raw
  if (!form.value.name) form.value.name = file.name.replace(/\.(mp3|flac|aac)$/i, '')
}

function onCover(file) {
  pickedCover.value = file.raw || null
}

function onLyric(file) {
  pickedLyric.value = file.raw || null
}

// 浏览器端读音频元数据时长（读不到回退 0，不打断提交）
function readDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(a.duration) || 0) }
      a.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
      a.src = url
    } catch (e) {
      resolve(0)
    }
  })
}

async function submitFile() {
  if (!picked.value) return message.warning('请先选择音频文件')
  if (!form.value.name) return message.warning('请填写歌名')
  uploading.value = true
  try {
    const up = await api.uploadAudio(picked.value)
    // 封面/歌词可选：选了才上传，地址随歌曲一起提交
    let coverUrl = null
    let lyricUrl = null
    if (pickedCover.value) coverUrl = (await api.uploadImage(pickedCover.value)).url
    if (pickedLyric.value) lyricUrl = (await api.uploadLyric(pickedLyric.value)).url
    await api.songSubmit({
      ...form.value,
      fileUrl: up.url,
      coverUrl,
      lyricUrl,
      fileFormat: (picked.value.name.split('.').pop() || 'mp3').toUpperCase(),
      duration: await readDuration(picked.value)
    })
    message.success('已提交，等待管理员审核')
    form.value = { name: '', album: '', style: '流行', language: '国语', singerName: '' }
    fileList.value = []
    picked.value = null
    coverList.value = []
    lyricList.value = []
    pickedCover.value = null
    pickedLyric.value = null
    tab.value = 'mine'
    loadMine()
  } finally {
    uploading.value = false
  }
}

// 从粘贴文案里提取链接：B站分享是“标题 链接”，定位 http/www 起始截取
function extractUrl(text) {
  const s = String(text || '').trim()
  const i = s.search(/https?:\/\/|www\./i)
  if (i < 0) return s
  const u = s.slice(i).split(/[\s一-龥]/)[0]
  return u.replace(/[,.;:!?，。；！？)）\]】>"']+$/, '')
}

async function startDownload() {
  const data = await api.mediaDownload({ ...link.value, url: extractUrl(link.value.url) })
  // 登记进全局任务 store：切页后由 store 继续轮询并通知结果
  task.value = taskStore.track(data.taskId, 'DOWNLOAD')
}

async function cancel() {
  await taskStore.cancel(task.value.taskId)
}

async function resubmit(row) {
  await api.songResubmit(row.id)
  message.success('已重新提交审核')
  loadMine()
}

async function loadMine() {
  mineLoading.value = true
  try {
    mine.value = listOf(await api.songMine({ page: 1, size: 50 }))
  } finally {
    mineLoading.value = false
  }
}

const taskTag = () => {
  const s = (task.value && task.value.status) || ''
  if (s === 'SUCCESS') return 'success'
  if (s === 'FAILED') return 'danger'
  if (s === 'CANCELLED') return 'info'
  return 'warning'
}
</script>

<style scoped>
.upload-form { max-width: 640px; }
.task-box { margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 12px; }
.task-line { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.stage { font-size: 13px; color: var(--text-muted); }
.task-error { color: var(--error); font-size: 13px; margin-top: 6px; }
.sub { color: var(--text-faint); font-size: 12px; }
</style>
