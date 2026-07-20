# AI 对话与批注执行子流程

当用户要使用或排查 Commentary 的 AI 侧边栏对话、AI 批注执行，或配置对应供应商时，走这里。

## 能力边界

两个入口当前开放的供应商不同：

| 入口 | 当前支持的供应商 |
| --- | --- |
| AI 侧边栏对话 | Claude、Codex、OpenCode |
| AI 批注执行 | Codex、Claude、OpenCode、Cursor、Qoder、CodeBuddy、Reasonix |

用户同时需要两个入口时，优先从共同支持的 Claude、Codex、OpenCode 中选择；没有偏好时沿用当前默认的 Codex。不要静默切换用户已经选择的供应商。

ACP UI 后端可能注册更多供应商，但不代表 Commentary 界面已经开放。当前不要把 Grok Build 或其他未列出的供应商写进 Commentary 配置，也不要仅凭 ACP UI 能启动它就宣称该入口支持。

## 前置顺序

严格按下面的顺序处理，不能只检查其中一项：

1. 按主文档确认 ACP UI 健康并保持运行。AI 对话、provider session 和 AI 批注执行都依赖 ACP UI；服务未就绪时停止本子流程。
2. 确认用户要使用哪个入口和供应商，并确认该供应商在上表对应入口中受支持。
3. 确认供应商自己的 CLI 已安装，并且 ACP UI 所在终端能够从 `PATH` 找到它。
4. 执行版本命令，确认 CLI 能在终端中正常启动。找到二进制但版本命令失败，不能算已安装可用。
5. 由用户在自己的终端完成供应商登录、授权或本地凭据配置。不要索取、代填、记录或回显 token、API key、验证码和账号凭据。
6. 登录或环境变量发生变化后，重启 ACP UI，让 provider 子进程继承最新环境，再重新检查健康状态。
7. 分别验证用户实际需要的入口；一个入口成功不能代替另一个入口的验证。

## CLI 检查

先检查命令是否能被当前终端找到：

- macOS / Linux：`command -v <command>`
- Windows：`where <command>`

再运行对应的无交互版本命令：

| 供应商 | CLI 命令 | 版本检查 | 用户侧登录或配置 |
| --- | --- | --- | --- |
| Claude | `claude` | `claude --version` | 启动 Claude CLI，按供应商流程完成登录 |
| Codex | `codex` | `codex --version` | `codex login` |
| OpenCode | `opencode` | `opencode --version` | `opencode auth login` |
| Cursor | `agent` | `agent --version` | `agent login` |
| Qoder | `qodercli` | `qodercli --version` | `qodercli login`，或由用户自行配置供应商支持的凭据 |
| CodeBuddy | `codebuddy` | `codebuddy --version` | 按 CodeBuddy CLI 的登录流程完成授权，或由用户自行配置供应商支持的凭据 |
| Reasonix | `reasonix` | `reasonix --version`；不支持时用 `reasonix version` | 由用户配置 Reasonix 项目、默认模型和模型供应商凭据 |

也可以用 ACP UI 的版本接口辅助检查：

```text
GET http://localhost:32124/api/acp/provider-versions?provider=<provider>
```

- `status: installed` 只表示本地 CLI 版本检查成功，不代表已经登录。
- `status: missing` 表示命令不在 ACP UI 进程可见的 `PATH` 中。
- `status: unknown` 需要结合 `reason` 和手动版本命令继续定位，不能直接判定可用。

缺少 CLI 时，明确指出缺少的命令，并提供该供应商当前官方安装方式或文档。未经用户明确许可，不代替用户安装软件，也不要改选其他供应商来掩盖问题。`npx` 能下载 ACP adapter 不等于供应商 CLI 已完成安装和授权。

## 登录与授权边界

- 登录、账号授权、验证码确认、token 申请和付费状态都由用户在供应商软件中完成。
- 只能检查登录后的结果，不要让用户把 secret 粘贴到对话、项目文件、批注文档或命令日志中。
- 用户通过环境变量提供凭据时，只确认变量是否由 ACP UI 启动环境继承，不读取或输出变量值。
- CLI 版本正常但 provider session 返回未登录、无权限、缺少模型或额度错误时，归类为供应商授权或账号状态问题，不要误报成 ACP UI 未启动。
- Reasonix 仅有命令和登录仍不够；还要有可用的默认模型及对应模型供应商配置。

## 分入口验证

### AI 侧边栏对话

1. 在 Commentary 中选择已确认就绪的 Claude、Codex 或 OpenCode。
2. 唤醒 AI，确认 provider session 能建立，而不只是侧边栏能打开。
3. 发送一个不修改文件的最小消息，确认能收到正常回复。
4. 失败时记录供应商和可操作的错误摘要，不记录原始凭据或完整敏感日志。

### AI 批注执行

1. 确认 AI 执行使用受支持的供应商，并配置真实的项目工作目录；工作目录不能为空，也不能用猜测路径。
2. 确认目标批注及其页面文件定位正确，再提交执行。
3. 验证任务确实进入 provider session 并返回执行结果；只有“已提交”提示不能证明执行成功。
4. 实际修改、任务状态和节点清理继续按 `references/comment-processing.md` 执行。只做能力配置时，不要虚构测试批注或修改用户代码。

## 故障分层

- 健康接口失败：先处理 ACP UI 启动或端口问题。
- CLI 查找或版本命令失败：处理供应商软件安装、`PATH` 或终端环境问题。
- CLI 正常但 session 认证失败：让用户完成该供应商的登录、授权或本地凭据配置。
- 侧边栏对话成功、批注执行失败：检查 AI 工作目录、页面文件定位、任务权限和批注执行配置。
- 批注执行成功、状态未更新或节点未清理：转到批注处理子流程修复文档状态链路，不要重复提交 AI 任务。

## 完成条件

最终明确报告：ACP UI 健康状态、目标入口、所选供应商、CLI 版本检查、用户授权是否已确认，以及侧边栏对话和 AI 批注执行各自的验证结果。任何一项未验证都要明确写出，不能用“应该可用”代替。
