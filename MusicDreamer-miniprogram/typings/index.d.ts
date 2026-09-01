// 最小可用的全局声明：覆盖本小程序用到的构造器；wx 用 any 简化（options 内字段直接写字面量）
type IAnyObject = Record<string, any>
type IAnyFunction = (...args: any[]) => any

declare const wx: any
declare const getApp: () => any
declare const getCurrentPages: () => any[]
declare const console: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void }
declare function setInterval(fn: (...args: any[]) => void, ms: number, ...args: any[]): number
declare function clearInterval(id: number): void
declare function setTimeout(fn: (...args: any[]) => void, ms: number, ...args: any[]): number
declare function clearTimeout(id: number): void
declare function Page(options: IAnyObject): void
declare function Component(options: IAnyObject): void
declare function App(options: IAnyObject): void
declare function Behavior(options: IAnyObject): void
