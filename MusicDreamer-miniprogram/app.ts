import { auth } from './services/auth'

App({
  onLaunch() {
    // 启动时从 storage 恢复登录态（token 过期由 api 层 2006 统一处理）
    auth.restore()
  }
})
