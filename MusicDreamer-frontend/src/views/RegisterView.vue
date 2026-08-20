<template>
  <div class="modal-overlay auth-modal" style="display: flex">
    <div class="modal-content">
      <a class="back-home" @click.prevent="$router.push('/')" href="#">← 返回首页</a>
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
        <h3>创建账号</h3>
      </div>

      <div class="modal-body">
        <div class="input-group">
          <label for="reg-username">用户名</label>
          <input id="reg-username" v-model="form.username" type="text" placeholder="3-50 位用户名" />
        </div>
        <div class="input-group">
          <label for="reg-email">邮箱</label>
          <input id="reg-email" v-model="form.email" type="text" placeholder="用于激活与找回密码" />
        </div>
        <div class="input-group">
          <label for="reg-password">密码</label>
          <input id="reg-password" v-model="form.password" type="password" placeholder="至少 6 位" />
        </div>
        <div class="input-group">
          <label for="reg-confirm">确认密码</label>
          <input id="reg-confirm" v-model="confirm" type="password" placeholder="再输入一次"
            @keyup.enter="doRegister" />
        </div>

        <button class="btn btn-primary" style="width: 100%; margin-top: 4px" :disabled="loading" @click="doRegister">
          {{ loading ? '创建中...' : '注册' }}
        </button>

        <div style="text-align: center; margin-top: 14px; font-size: 13px; color: var(--text-muted)">
          已有账号？<router-link to="/login" style="color: var(--accent); font-weight: 600">直接登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'

const router = useRouter()
const form = reactive({ username: '', email: '', password: '' })
const confirm = ref('')
const loading = ref(false)

async function doRegister() {
  if (!form.username || !form.email || !form.password) return ElMessage.warning('请填写完整')
  if (form.password.length < 6) return ElMessage.warning('密码至少 6 位')
  if (form.password !== confirm.value) return ElMessage.warning('两次密码不一致')
  loading.value = true
  try {
    await api.register(form)
    ElMessage.success('注册成功，请查收激活邮件后登录（未配置邮箱时见后端日志中的激活链接）')
    router.push('/login')
  } finally {
    loading.value = false
  }
}
</script>
