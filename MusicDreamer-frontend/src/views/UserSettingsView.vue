<template>
  <div class="container">
    <div class="page-header">
      <h1>个人设置</h1>
      <div class="page-subtitle">管理您的个人资料和账户设置</div>
    </div>

    <div class="settings-card">
      <h2>基本信息</h2>

      <div class="form-group">
        <label>用户名</label>
        <div class="readonly-field">{{ userStore.userId ? `用户${userStore.userId}` : '未登录' }}</div>
        <div class="field-help">用户名用于登录，注册后不可修改</div>
      </div>

      <div class="form-group">
        <label for="nickname-input">昵称</label>
        <input
          id="nickname-input"
          v-model="nicknameForm.nickname"
          type="text"
          placeholder="请输入您的昵称"
          :disabled="!userStore.isLogin"
        />
        <div class="field-help">昵称将在个人资料和评论中显示（2-50个字符）</div>
      </div>

      <button
        class="btn btn-primary"
        :disabled="!canSaveNickname || saving"
        @click="saveNickname"
      >
        {{ saving ? '保存中...' : '保存昵称' }}
      </button>
    </div>

    <div class="settings-card">
      <h2>账户操作</h2>
      <button class="btn btn-secondary" @click="$router.push('/change-password')">
        修改密码
      </button>
      <button class="btn btn-text" style="margin-left: 10px" @click="logout">
        退出登录
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { message } from '../utils/feedback'
import api from '../api'

const router = useRouter()
const userStore = useUserStore()

const nicknameForm = reactive({
  nickname: userStore.nickname || ''
})

const saving = ref(false)

const canSaveNickname = computed(() => {
  return userStore.isLogin &&
         nicknameForm.nickname.trim() &&
         nicknameForm.nickname !== userStore.nickname &&
         nicknameForm.nickname.length >= 2 &&
         nicknameForm.nickname.length <= 50
})

onMounted(() => {
  if (!userStore.isLogin) {
    message.warning('请先登录')
    router.push('/login')
  }
})

async function saveNickname() {
  if (!canSaveNickname.value) return

  saving.value = true
  try {
    await api.updateUserInfo({ nickname: nicknameForm.nickname.trim() })

    // 更新本地存储
    userStore.nickname = nicknameForm.nickname.trim()
    userStore.persist()

    message.success('昵称更新成功')
  } catch (error) {
    message.error('昵称更新失败：' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

function logout() {
  userStore.clear()
  message.success('已退出登录')
  router.push('/')
}
</script>

<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 14px;
}

.settings-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid var(--border);
}

.settings-card h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--text);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text);
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group input:disabled {
  background-color: var(--surface-2);
  color: var(--text-muted);
}

.readonly-field {
  padding: 10px 12px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--text-muted);
}

.field-help {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.btn {
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-dark);
}

.btn-secondary {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--surface-3);
}

.btn-text {
  background: transparent;
  color: var(--text-muted);
  border: none;
}

.btn-text:hover {
  color: var(--text);
}
</style>