// 我的：用户信息卡 + 退出登录（设置类功能按设计裁剪，仅保留最小闭环）
import { api } from '../../services/api'
import { auth } from '../../services/auth'

const ROLE_TEXT: Record<number, string> = { 0: '普通用户', 1: '歌手', 2: '管理员' }

Page({
  data: { user: null as any, loggedIn: false, roleText: '' },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn, user: (auth.get() && auth.get()!.user) || null })
    if (loggedIn) {
      // 刷新最新资料（头像/昵称可能在他端改过）
      api.userInfo()
        .then((u: any) => {
          auth.save(auth.getToken(), u)
          this.setData({ user: { ...u, avatar: u.avatar }, roleText: ROLE_TEXT[u.role] || '普通用户' })
        })
        .catch(() => {})
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onLogout() {
    const that = this
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success: async (res: any) => {
        if (!res.confirm) return
        try {
          await api.logout()
        } catch (e) {
          /* 本地登出不受远端失败影响 */
        }
        auth.clear()
        that.setData({ loggedIn: false, user: null })
        wx.showToast({ title: '已退出', icon: 'none' })
      }
    })
  }
})
