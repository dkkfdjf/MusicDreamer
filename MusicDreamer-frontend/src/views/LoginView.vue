<template>
  <div class="modal-overlay auth-modal" style="display: flex">
    <div class="modal-content">
      <div class="auth-brand-line">
        <svg width="40" height="40" viewBox="0 0 24 24">
          <rect x="3" y="10" width="3" height="9" rx="1.5" fill="var(--accent)" />
          <rect x="8" y="5" width="3" height="18" rx="1.5" fill="var(--accent)" />
          <rect x="13" y="8" width="3" height="12" rx="1.5" fill="var(--accent)" />
          <rect x="18" y="3" width="3" height="20" rx="1.5" fill="var(--accent)" />
        </svg>
        <div>
          <div class="app-title" style="text-align: center">Music Dreamer</div>
          <div class="app-slogan" style="text-align: center">悦享音乐，让每一首歌都被听见</div>
        </div>
      </div>

      <div class="modal-header" style="border: none; padding: 0 0 4px">
        <h3>欢迎回来</h3>
      </div>

      <div class="modal-body">
        <div class="input-group">
          <label for="login-username">用户名</label>
          <input id="login-username" v-model="form.username" type="text" placeholder="输入用户名"
            @keyup.enter="doLogin" />
        </div>
        <div class="input-group">
          <label for="login-password">密码</label>
          <input id="login-password" v-model="form.password" type="password" placeholder="输入密码"
            @keyup.enter="doLogin" />
        </div>
        <label class="download-option" style="margin: 4px 0 10px">
          <input v-model="form.remember" type="checkbox" />
          <span>记住我（7 天内免登录）</span>
        </label>

        <button class="btn btn-primary" style="width: 100%; margin-top: 4px" :disabled="loading" @click="doLogin">
          {{ loading ? '登录中...' : '登录' }}
        </button>

        <div style="text-align: center; margin-top: 14px; font-size: 13px; color: var(--text-muted)">
          还没有账号？<router-link to="/register" style="color: var(--accent); font-weight: 600">创建账号</router-link>
        </div>

        <details style="margin-top: 12px">
          <summary style="font-size: 12px; color: var(--text-faint); cursor: pointer; user-select: none">
            忘记密码？
          </summary>
          <div style="margin-top: 10px">
            <div class="input-group">
              <label>注册邮箱</label>
              <input v-model="reset.email" type="text" placeholder="you@example.com" />
            </div>
            <button class="btn btn-secondary" style="padding: 5px 12px; font-size: 12px" @click="sendCode">
              发送验证码
            </button>
            <div style="display: flex; gap: 8px; margin-top: 10px">
              <input v-model="reset.code" type="text" placeholder="验证码" style="flex: 0 0 90px" />
              <input v-model="reset.newPassword" type="password" placeholder="新密码" style="flex: 1" />
              <button class="btn btn-primary" style="padding: 5px 12px; font-size: 12px" @click="doReset">重置</button>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const form = reactive({ username: '', password: '', remember: false })
const reset = reactive({ email: '', code: '', newPassword: '' })
const loading = ref(false)

async function doLogin() {
  if (!form.username || !form.password) return ElMessage.warning('请输入用户名和密码')
  loading.value = true
  try {
    const data = await api.login(form)
    userStore.setLogin(data)
    userStore.refreshInfo()
    ElMessage.success('登录成功')
    router.push(route.query.redirect || '/')
  } finally {
    loading.value = false
  }
}

async function sendCode() {
  if (!reset.email) return ElMessage.warning('请输入注册邮箱')
  await api.sendResetCode(reset.email)
  ElMessage.success('验证码已发送（未配置邮箱时见后端日志）')
}

async function doReset() {
  await api.resetPassword(reset)
  ElMessage.success('密码已重置，请使用新密码登录')
}
</script>
