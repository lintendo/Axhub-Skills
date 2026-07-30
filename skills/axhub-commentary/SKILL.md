---
name: axhub-commentary
description: 处理 Axhub Commentary 完整工作流。优先读取本地页面批注文档，落实修改并更新批注状态，或在用户确认后写入删除标记；本地读取失败时再确认 ACP UI 并生成临时可批注地址。也可为已接入 @axhub/annotation 的页面准备标注编辑环境，或配置 AI 侧边栏对话、AI 批注执行、调整面板属性和多方案比稿。当用户提到 Axhub Commentary、Axhub Chrome 扩展页面批注、可批注链接、comments.json、标注编辑按钮、修改标注内容、Annotation Runtime、annotationSourcePath、根据 Commentary 意见改代码、更新或清理批注、页面 AI、供应商安装登录、调整面板、方案切换或页面定位信息时使用。可批注目标是 Figma 时，也应与 figma-content-operator 组合。
---

# Axhub Commentary 工作流

先判断工作线，再按任务读取对应的分文档和执行必要检查。不要要求目标项目安装编辑器 runtime；编辑器由 Axhub Chrome 扩展或宿主预览环境提供。

## 0. 按需检测 ACP UI

批注读取与处理先直接读取本地 `comments.json`，不检测 ACP UI；只有本地批注无法定位、读取或通过格式校验时，才检测 ACP UI，并在服务就绪后生成临时可批注地址交给用户。用户直接要求生成可批注地址、使用 AI 对话/执行或宿主资源工具时，也需要检测。

- 访问 `http://localhost:32124/api/health`，只有响应同时满足 `status: "ok"` 和 `service: "acp-ui"` 才算就绪；端口占用、页面可打开或存在相关进程都不能代替该检测。
- 检测失败时才读取 `references/acp-native-bootstrap.md`，按原有非沙箱规则启动并再次确认 health。Native Host 是后续可选能力，只有用户明确确认或主动要求安装时才注册。

Commentary 的 AI 对话、AI 批注执行、provider session、宿主资源工具和本地标注源读写依赖 ACP UI；未确认 health 时，不得宣称这些能力就绪。本地批注记录与 tweak 的读取回写、属性调整和页面内方案切换不依赖 ACP UI。

## 工作分流

先判断任务属于哪条工作线，只读取对应参考文件。

### 1. 批注读取与处理（主要）

任务涉及页面批注、改稿意见、批注图片、批注状态或显式删除批注节点时，读 `references/comment-processing.md`。

### 2. 可批注地址与环境准备（主要）

任务是生成可批注地址或确认页面定位时，读 `references/environment-context.md`。这里优先使用不改项目文件的临时链接方案；只有用户明确要求稳定入口时，才进入固定接入。

Figma 是例外：最终链接只给原始 Figma URL 加绝对 `projectPath`，不加 `try-plugin-*`。扩展必须先按稳定文件身份完成绑定，再自行启动 Drafito。

### 3. Annotation 标注环境准备（主要）

用户需要 Annotation 能力时，按目标处理：

1. 需要开启 Annotation Runtime：读 [axhub-annotation-standalone](https://github.com/lintendo/Axhub-Skills/blob/main/skills/axhub-annotation-standalone/SKILL.md) 完成页面接入。
2. 需要让扩展修改标注内容：确保页面使用可编辑的标注源。外部 JSON 放在当前 `filePath` 同目录并命名为 `annotation-source.json`；单 HTML 页面把标注源内嵌在当前 HTML，并让 `annotationSourcePath` 指向该文件。通过页面上下文提供 `projectPath`、`filePath` 和必要的 `annotationSourcePath`，生成并打开可批注地址交给用户。只有标注源不符合上述两种约定时，才读 `references/environment-context.md` 处理自定义路径。

### 4. AI 对话与批注执行（主要）

任务涉及 AI 侧边栏对话、唤醒页面 AI、把批注交给 AI 执行、配置供应商，或排查供应商软件安装、终端可用性和登录授权时，读 `references/ai-capabilities.md`。支持范围见该文档，实际可见项和默认项以 ACP UI 当前配置为准。

### 5. 页面侧接入（低频）

只有用户明确要求修改页面接入能力时，才按目标读取对应分文档：

- 调整面板属性、页面级属性聚合 → 读 `references/property-editing.md`
- 多方案设计比稿、页面内方案切换 → 读 `references/design-bid.md`

属性调整和多方案比稿都是低频、按需能力。这是修改页面代码的工作线；临时可批注链接和已有 Runtime 的标注内容编辑不属于页面侧接入，不要为它们修改业务页面实现。

批注要求新增接入能力时可以跨工作线：先读批注处理流程确定任务，再按具体目标补读一个页面侧接入参考。

## 实施顺序

1. 先判断任务是否属于主要流程 1、2、3 或 4；只有用户明确要求时才进入低频流程 5。
2. 只读取命中流程的分文档；批注处理先读本地记录，失败后才检测 ACP UI 并生成临时地址，其他流程按上面的使用条件检测。
3. 需要检测且 health 失败时才读取 `references/acp-native-bootstrap.md`，不要提前加载启动细节。
4. 批注处理成功后先写入 `completed` 并保留节点，再询问用户是否清除；用户确认后只写入删除标记，实际清理由扩展统一执行。临时地址默认不修改项目文件；页面侧接入完成后再验证回写能力。

## 交付要求

最终回复按命中的子流程包含必要信息：

- ACP UI：是否已确认健康；如果需要用户手动启动，给出准确命令和当前阻塞状态
- 批注处理：完成了哪些界面修改、是否还有未处理或异常批注、做了哪些验证；写入 `completed` 后询问用户是否清除
- 标注环境：可批注地址、采用的标注源形式和实际路径；未完成时说明缺少 Runtime 接入还是页面上下文
- AI 能力：所选供应商、CLI 与登录是否就绪、provider session 是否可用；不要暴露 token 或其他凭据
- 页面接入：修改了哪些文件、暴露了哪些属性或方案字段、做了哪些验证
- 回复保持面向用户，不要把内部批注状态、同步细节或命令日志当作主要内容

## 参考

- `references/comment-processing.md`
- `references/ai-capabilities.md`
- `references/property-editing.md`
- `references/design-bid.md`
- `references/environment-context.md`
- `references/acp-native-bootstrap.md`
