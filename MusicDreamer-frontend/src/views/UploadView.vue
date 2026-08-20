<template>
  <div class="upload">
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
            <el-form-item label="选项">
              <el-checkbox v-model="link.wantSubtitle">尝试下载字幕</el-checkbox>
              <el-checkbox v-model="link.wantTranscribe">AI 转写歌词（需先下载模型）</el-checkbox>
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
              已入库（待审核），去首页看看
            </el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 我的歌曲 -->
      <el-tab-pane label="我的歌曲" name="mine">
        <el-table :data="mine" v-loading="mineLoading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="歌名" min-width="160" />
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
import { ref, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { listOf, SONG_STATUS, STYLES, LANGUAGES, isTaskTerminal } from '../utils'

const tab = ref('file')
const form = ref({ name: '', album: '', style: '流行', language: '国语' })
const fileList = ref([])
const picked = ref(null)
const uploading = ref(false)

const link = ref({ url: '', wantSubtitle: true, wantTranscribe: false })
const task = ref(null)
const running = ref(false)
let timer = null

const mine = ref([])
const mineLoading = ref(false)

function onFile(file) {
  if (file.raw && file.raw.size > 50 * 1024 * 1024) {
    ElMessage.error('文件超过 50MB 限制')
    fileList.value = []
    return
  }
  picked.value = file.raw
  if (!form.value.name) form.value.name = file.name.replace(/\.(mp3|flac|aac)$/i, '')
}

async function submitFile() {
  if (!picked.value) return ElMessage.warning('请先选择音频文件')
  if (!form.value.name) return ElMessage.warning('请填写歌名')
  uploading.value = true
  try {
    const up = await api.uploadAudio(picked.value)
    await api.songSubmit({
      ...form.value,
      fileUrl: up.url,
      fileFormat: (picked.value.name.split('.').pop() || 'mp3').toUpperCase(),
      duration: 0
    })
    ElMessage.success('已提交，等待管理员审核')
    form.value = { name: '', album: '', style: '流行', language: '国语' }
    fileList.value = []
    picked.value = null
    tab.value = 'mine'
    loadMine()
  } finally {
    uploading.value = false
  }
}

async function startDownload() {
  const data = await api.mediaDownload({ ...link.value })
  task.value = { taskId: data.taskId, status: 'PENDING', progress: 0, stage: '已提交…' }
  running.value = true
  timer = setInterval(poll, 1000)
}

async function poll() {
  if (!task.value) return
  try {
    task.value = await api.mediaTask(task.value.taskId)
  } catch (e) {
    return
  }
  if (isTaskTerminal(task.value.status)) {
    clearInterval(timer)
    timer = null
    running.value = false
    loadMine()
  }
}

async function cancel() {
  await api.mediaCancel(task.value.taskId)
  clearInterval(timer)
  timer = null
  running.value = false
  poll()
}

async function resubmit(row) {
  await api.songResubmit(row.id)
  ElMessage.success('已重新提交审核')
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

onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.upload-form { max-width: 640px; }
.task-box { margin-top: 10px; border-top: 1px dashed #dcdfe6; padding-top: 12px; }
.task-line { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.stage { font-size: 13px; color: #606266; }
.task-error { color: #f56c6c; font-size: 13px; margin-top: 6px; }
.sub { color: #909399; font-size: 12px; }
</style>
