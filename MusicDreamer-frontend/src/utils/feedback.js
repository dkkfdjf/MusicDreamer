// WeUI 原生交互反馈封装（逐步替换 Element Plus 的 ElMessage / ElMessageBox）
// weui.js 为 UMD 模块，Vite 下按默认导入使用其 toast/topTips/alert/confirm。
import weui from 'weui.js'

// 轻提示（成功/一般）：顶部横条 toast，1.5s 自动消失（样式见 app.css .weui-toast）
export function toast(message, opts = {}) {
  weui.toast(message, { duration: 1500, ...opts })
}

// 顶部条提示（警告/错误）：黄色横条，2s
export function topTips(message, opts = {}) {
  weui.topTips(message, { duration: 2000, ...opts })
}

// 语义化快捷方法，贴合旧 ElMessage 用法
export const message = {
  success: (m) => weui.toast(m, { duration: 1500 }),
  info: (m) => weui.toast(m, { duration: 1500 }),
  warning: (m) => weui.topTips(m, { duration: 2000 }),
  error: (m) => weui.topTips(m, { duration: 2000 })
}

// 确认框：返回 Promise —— 确认 resolve，取消 reject（对齐 ElMessageBox.confirm）
// weui dialog 是模块级单例：点按钮后要等 0.3s 淡出动画播完 _sington 才复位，
// 期间再调 confirm 会拿到垂死的旧节点、新窗不渲染、Promise 永不 settle。
// 故自管关闭：onClick 里显式 dlg.hide(cb)（cb 在 animationend 即单例复位后触发），
// resolve/reject 均延后到该时刻，连续两次 confirm 之间天然隔出安全窗口。
export function confirm(content, { title = '提示', okText = '确定', cancelText = '取消' } = {}) {
  return new Promise((resolve, reject) => {
    const dlg = weui.confirm(content, {
      title,
      buttons: [
        { label: cancelText, type: 'default', onClick: () => { dlg.hide(() => reject(new Error('cancel'))); return false } },
        { label: okText, type: 'primary', onClick: () => { dlg.hide(() => resolve(true)); return false } }
      ]
    })
  })
}

// 告知框：返回 Promise，点击确定后 resolve（同样等弹窗关闭、单例复位后再 settle）
export function alert(content, { title = '提示', okText = '知道了' } = {}) {
  return new Promise((resolve) => {
    const dlg = weui.alert(content, {
      title,
      buttons: [{ label: okText, type: 'primary', onClick: () => { dlg.hide(() => resolve(true)); return false } }]
    })
  })
}

export default { toast, topTips, message, confirm, alert }
