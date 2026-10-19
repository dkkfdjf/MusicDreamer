# 成员A · UML 图（华为云 CodeArts 用）

五个图、两套格式 + PNG 成品，内容全部对齐真实代码（类名/接口/流程来自 Mod_media 等源码）。

```
docs/diagrams/
├── 01-系统架构图.puml/.png        组件图：客户端→Gateway→7微服务→外部依赖与存储
├── 02-功能模块图.puml/.png        模块树：后端三服务 + 前端四入口
├── 03-系统用例图.puml/.png        用例图：用户/管理员 + 4 外部参与者，include/extend
├── 04-歌词链路活动图.puml/.png    活动图：三级降级 + LyricAligner 校准 + 公共收尾
├── 05-求歌下载管线时序图.puml/.png 时序图：求歌→下载→入库→歌词→指纹→回填全闭环
├── mermaid/                      同五个图的 Mermaid 版（.mmd 源码 + .png）
└── README.md
```

## 在华为云 CodeArts 里怎么用

| 场景 | 做法 |
|---|---|
| CodeArts Snap（码道 AI 助手） | 新建对话，把 `.mmd`（推荐）或 `.puml` 内容整段粘贴，让 Snap「渲染/解释这张图」，或在其支持预览的入口直接出图；也可让 Snap 在此基础上改（如"把识别相关节点去掉"） |
| Wiki / 文档 / Markdown | 若编辑器支持 Mermaid 代码块，粘 `.mmd` 内容即可内嵌渲染 |
| 报告配图 | 直接用已渲染的 `.png`。**mermaid/ 下的 PNG 是默认主题（白底灰框、无自定义配色），与 CodeArts/Mermaid 渲染出的效果一致；根目录的 .png 是 PlantUML 版** |

## 两套格式怎么选

- **PlantUML（.puml）**：UML 语义最正规（真用例图、真组件图），适合设计文档与答辩材料。
- **Mermaid（.mmd）**：在 CodeArts 生态和各类 Markdown 工具里通用性最好。注意 Mermaid 没有原生用例图，03 用流程图+双圈参与者模拟。

## 内容对照（成员A任务分工）

- 求歌→粘贴链接→任务队列→下载转码→落盘→入库待审→歌词回写→指纹→求歌回填：图 05 全链路
- 特色1 歌曲下载管线（进程编排+任务引擎+进度/取消）：图 05 + 图 02 的 TaskManager/ProcessExecutor 分支
- 特色2 歌词三级降级+时间轴校准：图 04（LRCLIB→CC字幕→whisper；LyricAligner 单调配对/时间窗/分段偏移）
- CRUD（求歌处理/系统设置/响度回写）：图 03 用例 + 图 02 模块树

## 已踩过的语法坑（改文件时注意）

- PlantUML 活动图：`else` 分支不能为空；分支标签/条件里不能嵌 ASCII 括号 `()`。
- Mermaid：`class 节点 类名` 中间必须有空格；时序图 `== 分节` 语法兼容性差，用 `rect`+`note` 分节代替。
