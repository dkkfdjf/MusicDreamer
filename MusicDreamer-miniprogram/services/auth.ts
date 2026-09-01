// 登录态：wx storage 持久化；api 层遇 2006/401 时调 clear + reLaunch 登录页
import { resolveUrl } from '../config'

export interface UserVO {
  id: number
  username: string
  email: string
  nickname: string
  avatar: string
  role: number
}

const TOKEN_KEY = 'md_token'
const USER_KEY = 'md_user'

let token = ''
let user: UserVO | null = null

export const auth = {
  /** app 启动时从 storage 恢复 */
  restore(): void {
    try {
      token = wx.getStorageSync(TOKEN_KEY) || ''
      const u = wx.getStorageSync(USER_KEY)
      user = u ? { ...u, avatar: resolveUrl(u.avatar) } : null
    } catch (e) {
      token = ''
      user = null
    }
  },
  get(): { token: string; user: UserVO } | null {
    return token && user ? { token, user } : null
  },
  getToken(): string {
    return token
  },
  isLoggedIn(): boolean {
    return !!(token && user)
  },
  save(tk: string, u: any): void {
    token = tk
    user = { ...u, avatar: resolveUrl(u.avatar) }
    wx.setStorageSync(TOKEN_KEY, tk)
    wx.setStorageSync(USER_KEY, u)
  },
  clear(): void {
    token = ''
    user = null
    try {
      wx.removeStorageSync(TOKEN_KEY)
      wx.removeStorageSync(USER_KEY)
    } catch (e) {}
  },
  /** 未登录则提示并跳登录页；返回是否已登录 */
  requireLoginTip(): boolean {
    if (auth.isLoggedIn()) return true
    wx.showToast({ title: '请先登录', icon: 'none' })
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  }
}
