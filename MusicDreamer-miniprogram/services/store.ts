// 通用 pub/sub store：set 浅合并并同步通知订阅者；subscribe 返回退订函数
export function createStore<T extends object>(initial: T) {
  let state = { ...initial }
  const subs = new Set<(s: T) => void>()
  return {
    get(): T {
      return state
    },
    set(patch: Partial<T>): void {
      state = { ...state, ...patch }
      subs.forEach((fn) => fn(state))
    },
    subscribe(fn: (s: T) => void): () => void {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    }
  }
}
