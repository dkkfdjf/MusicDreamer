// 三态切换：login | register | reset（找回密码：用户名+邮箱+新密码）
import { api } from '../../services/api'
import { auth } from '../../services/auth'

Page({
  data: {
    mode: 'login' as 'login' | 'register' | 'reset',
    username: '',
    password: '',
    nickname: '',
    email: '',
    newPassword: '',
    loading: false
  },
  onShow() {
    // 已登录直接回首页（token 过期跳过来的场景会先 clear，不会死循环）
    if (auth.isLoggedIn()) wx.reLaunch({ url: '/pages/home/home' })
  },
  onField(e: any) {
    // 统一输入绑定：data-field 指定字段
    const field = e.currentTarget.dataset.field as string
    this.setData({ [field]: e.detail.value } as any)
  },
  switchMode(e: any) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },
  async submit() {
    if (this.data.loading) return
    const d = this.data
    if (d.mode === 'login') {
      if (!d.username || !d.password) {
        wx.showToast({ title: '请填写用户名和密码', icon: 'none' })
        return
      }
      await this.run(async () => {
        const vo = await api.login({ username: d.username, password: d.password, remember: true })
        auth.save(vo.token, vo)
        wx.reLaunch({ url: '/pages/home/home' })
      })
    } else if (d.mode === 'register') {
      if (!d.username || !d.nickname || !d.email || !d.password) {
        wx.showToast({ title: '请填写完整注册信息', icon: 'none' })
        return
      }
      await this.run(async () => {
        await api.register({ username: d.username, nickname: d.nickname, email: d.email, password: d.password })
        wx.showToast({ title: '注册成功，请查收激活邮件后登录', icon: 'none', duration: 3000 })
        this.setData({ mode: 'login' })
      })
    } else {
      if (!d.username || !d.email || !d.newPassword) {
        wx.showToast({ title: '请填写用户名、注册邮箱和新密码', icon: 'none' })
        return
      }
      await this.run(async () => {
        await api.resetPassword({ username: d.username, email: d.email, newPassword: d.newPassword })
        wx.showToast({ title: '密码已重置，请登录', icon: 'none' })
        this.setData({ mode: 'login', password: d.newPassword })
      })
    }
  },
  async run(fn: () => Promise<void>) {
    this.setData({ loading: true })
    try {
      await fn()
    } catch (e) {
      // api 层已 toast 过
    } finally {
      this.setData({ loading: false })
    }
  }
})
