<template>
  <div class="admin">
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
        <el-table :data="allSongs" v-loading="loading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="歌名" min-width="140" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="(SONG_STATUS[row.status] || {}).type">{{ (SONG_STATUS[row.status] || {}).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button v-if="row.status === 2" size="small" type="danger" plain @click="takedown(row)">下架</el-button>
              <el-button v-if="row.status === 0" size="small" type="success" plain @click="relist(row)">重新上架</el-button>
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
          <template #header>媒体工具（yt-dlp 保持最新可应对 B 站风控）</template>
          <el-table :data="toolsList">
            <el-table-column prop="name" label="工具" width="120" />
            <el-table-column prop="version" label="本地版本" min-width="140" />
            <el-table-column prop="latest" label="最新版本" min-width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.alive ? 'success' : 'danger'">{{ row.alive ? '健康' : '不可用' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" style="margin-top:10px" @click="updateYtdlp">检查并更新 yt-dlp</el-button>
        </el-card>
        <el-card class="tools-card">
          <template #header>whisper 模型（下载需确认，勿静默拉大文件）</template>
          <el-table :data="models">
            <el-table-column prop="key" label="规格" width="100" />
            <el-table-column prop="label" label="定位" width="130" />
            <el-table-column prop="sizeText" label="体积" width="110" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.isCurrent ? 'success' : row.downloaded ? 'info' : 'warning'">
                  {{ row.isCurrent ? '使用中' : row.downloaded ? '已下载' : '未下载' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button v-if="!row.downloaded" size="small" type="primary" @click="modelDownload(row)">下载</el-button>
                <el-button v-if="row.downloaded && !row.isCurrent" size="small" @click="modelUse(row)">切换</el-button>
                <el-button v-if="row.downloaded && !row.isCurrent" size="small" type="danger" plain
                  @click="modelDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <ReasonDialog v-model="reasonVisible" :title="reasonTitle" @confirm="onReasonConfirm" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { listOf, SONG_STATUS, fmtTime } from '../utils'
import ReasonDialog from '../components/ReasonDialog.vue'

const tab = ref('audit')
const loading = ref(false)
const auditSongs = ref([])
const allSongs = ref([])
const users = ref([])
const applications = ref([])
const reports = ref([])
const toolsList = ref([])
const models = ref([])

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
    if (tab.value === 'songs') allSongs.value = listOf(await api.songAdminList({ page: 1, size: 100 }))
    if (tab.value === 'users') users.value = listOf(await api.userList({ page: 1, size: 100 }))
    if (tab.value === 'singers') applications.value = listOf(await api.singerApplications({ status: 1 }))
    if (tab.value === 'reports') reports.value = listOf(await api.reportList({ status: 1, page: 1, size: 50 }))
    if (tab.value === 'tools') {
      toolsList.value = listOf(await api.toolsStatus())
      models.value = listOf(await api.models())
    }
  } finally {
    loading.value = false
  }
}

async function audit(row, pass) {
  if (pass) {
    await api.songAudit({ songId: row.id, pass: true })
    ElMessage.success('已通过，歌曲发布')
  } else {
    askReason('驳回原因', async (reason) => {
      await api.songAudit({ songId: row.id, pass: false, rejectReason: reason })
      ElMessage.success('已驳回')
      load()
    })
    return
  }
  load()
}

function takedown(row) {
  askReason('下架原因', async (reason) => {
    await api.songTakedown(row.id, reason)
    ElMessage.success('已下架')
    load()
  })
}

async function relist(row) {
  await api.songRelist(row.id)
  ElMessage.success('已重新上架')
  load()
}

async function toggleUser(row) {
  await api.setUserStatus({ userId: row.id, status: row.status === 1 ? 0 : 1 })
  ElMessage.success('已更新')
  load()
}

async function singerAudit(row, pass) {
  if (pass) {
    await api.singerAudit({ applicationId: row.id, pass: true })
    ElMessage.success('已通过，申请人升级为歌手')
  } else {
    askReason('驳回原因', async (reason) => {
      await api.singerAudit({ applicationId: row.id, pass: false, rejectReason: reason })
      ElMessage.success('已驳回')
      load()
    })
    return
  }
  load()
}

async function handleReport(row, pass, action) {
  await api.reportHandle({ id: row.id, pass, action: action || '', handleResult: action === 'takedown' ? '核实违规，已下架' : '' })
  ElMessage.success('已处理')
  load()
}

async function updateYtdlp() {
  await api.updateYtdlp()
  ElMessage.success('更新任务已提交，稍后刷新查看')
}

async function modelDownload(row) {
  await api.modelDownload(row.key)
  ElMessage.success('模型下载任务已提交')
}

async function modelUse(row) {
  await api.modelUse(row.key)
  ElMessage.success('已切换，下次任务生效')
  load()
}

async function modelDelete(row) {
  await api.modelDelete(row.key)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<style scoped>
.admin { min-height: 60vh; }
.tools-card { margin-bottom: 14px; }
</style>
