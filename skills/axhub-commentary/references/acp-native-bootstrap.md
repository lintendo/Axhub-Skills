# ACP UI 启动与诊断

仅在主文档的 ACP health 检测失败，或用户主动要求安装、注册或诊断 Native Host 时读取本文。若尚未检测，先返回主文档执行检测；端口占用、页面可打开或存在相关进程都不能代替 health。

本文中的 `<skill-dir>` 表示当前 `axhub-commentary/SKILL.md` 所在目录。执行 bundled 脚本前先解析该目录并使用绝对路径，不要假设终端当前位于 Skill 目录。

## 启动流程

1. 如果用户刚刚从扩展主动发起 AI/Commentary 启动，并且 Native Host 已经注册，可以复用现有 hook。扩展仍会先检测 health，只有不可用时才发送 Native Message。
2. 其他情况默认先直接启动 ACP UI，不要为了完成本次启动而先安装 Native Host。能明确确认 AI 的终端处于非沙箱且会保留后台进程时，执行 `node "<skill-dir>/scripts/start-acp-ui.mjs"`；脚本会再次检测 health，并与 Native Host 共用原子启动租约，只允许一个进程在服务不可用时启动固定 NPX 命令。
3. 无法确认非沙箱环境、无法在沙箱外执行，或执行环境会回收后台进程时，不要绕过限制；引导用户在自己的终端运行下方 NPX 命令。
4. 不论由扩展、AI 还是用户启动，都继续轮询 `http://localhost:32124/api/health`。只有响应同时满足 `status: "ok"` 和 `service: "acp-ui"`，才能返回主工作流；Native Message 已接受或 NPX 已执行都不能代替 health。
5. health 超时或协议错误时停止依赖 ACP UI 的流程，明确说明还缺少的步骤并按下方诊断；纯本地页面修改可以继续，但交付时说明 AI 能力未验证。

直接启动命令固定为：

```bash
npx -y @axhub/acp@latest
```

ACP UI 是持续依赖，不是执行完即退出的一次性命令。启动后保持进程运行，不要在任务完成时主动终止用户已有或本次启动的 ACP UI 服务。如果 AI 的执行环境会回收进程，改用可保持运行的非沙箱终端或会话；做不到时让用户在自己的终端启动。

ACP 自带默认来源列表，正式发行扩展已经包含在默认列表时不要传扩展 ID，也不要重复配置来源。只有本地加载版或其他特殊安装的真实扩展 ID 确实需要加入 ACP 运行时 trusted-host 列表时，才传入：

```bash
AXHUB_EXTENSION_ID=<extension-id> \
node "<skill-dir>/scripts/start-acp-ui.mjs"
```

脚本只接受 32 位 Chromium 扩展 ID，并转换为精确 origin；不要设置 wildcard。启动时不写入 `ACP_UI_CORS_ORIGINS` 或 `ACP_UI_TRUSTED_HOST_ORIGINS`，始终保留 `@axhub/acp` 自己的默认来源列表。health 就绪后，脚本通过 ACP 官方命令执行进程内追加：

```bash
npx -y @axhub/acp@latest trusted-host add chrome-extension://<extension-id> --port 32124
```

这个命令只向明确端口对应的进程追加 trusted host，不追加 CORS，不修改 ACP 的启动默认值。脚本会从实际 health URL 解析并传递端口，避免测试实例和默认实例并存时追加到错误进程。ACP 当前版本没有运行时追加 CORS 的公开入口；非默认扩展 origin 如果还需要直接访问资源 API，必须先由 ACP 提供追加式 CORS 能力，Skill 不得通过设置 `ACP_UI_CORS_ORIGINS` 覆盖整份默认列表。

只处理 Chromium 内核浏览器扩展。Chrome、Edge、Brave、Arc、Opera 等浏览器的扩展页面都使用 `chrome-extension://`。非默认安装先从扩展管理页读取真实 ID，不要猜测或沿用其他浏览器的 ID。

## 可选推荐：Native Host

先通过主文档的 health 检测确认 ACP UI 可用；如果尚未健康，先用上面的直接启动方式处理。确认服务可用后再考虑 Native Host。Native Host 的作用只是让用户以后从扩展主动打开 AI/Commentary 时可以请求启动 ACP UI；它不是本次工作流的前置条件。

只有以下任一条件满足时，才能进入注册流程：

- AI 已向用户说明会写入固定用户目录、浏览器 Native Messaging manifest，以及 Windows 下的 HKCU registry，用户明确同意
- 用户主动要求安装、注册或启用 ACP Native Host

不要把用户打开 Commentary、沉默、未反对或仅同意启动 ACP UI 视为同意安装 Native Host。没有明确同意时，只完成当前 ACP UI 启动和 health 验证，不执行 `register.mjs`。

Native host 单文件已随 Skill 放在 `scripts/acp-native-host.mjs`，不需要拉取其他源码、安装额外 NPM 包或执行构建。用户确认后，根据当前浏览器只执行下面对应的一组注册与校验命令，注册命令必须包含显式门禁参数：

```bash
node "<skill-dir>/scripts/register.mjs" --confirm-native-host-install --browser chrome --extension-id cndglokmgjecikflojjieeeajbljgfae
node "<skill-dir>/scripts/doctor.mjs" --json --browser chrome --extension-id cndglokmgjecikflojjieeeajbljgfae

node "<skill-dir>/scripts/register.mjs" --confirm-native-host-install --browser edge --extension-id ahkknhkjionomkpjfiinnbjbdghccigm
node "<skill-dir>/scripts/doctor.mjs" --json --browser edge --extension-id ahkknhkjionomkpjfiinnbjbdghccigm
```

非默认安装先从扩展管理页取得实际 ID，并在同组两条命令中同时替换。缺少 `--confirm-native-host-install` 时，注册脚本会在任何文件或 registry 写入前拒绝执行；只有紧随注册执行的 doctor 返回 `ok: true`，才能声明 Native Host 已注册，否则回到上面的直接启动流程。

注册脚本从自身目录读取 bundled host，并复制到稳定的用户目录：

- macOS/Linux：`~/.axhub/acp-native-host/`
- Windows：`%LOCALAPPDATA%\Axhub\acp-native-host\`

注册脚本按平台生成 `run_host.sh` 或 `run_host.bat`，写入 `node_path.txt`、用户级 manifest 和 Windows HKCU registry。重复注册会合并真实扩展 origin；禁止 wildcard。注册始终是显式用户级操作，不自动触发 sudo/UAC。

在 macOS/Linux 上，注册目录和日志目录使用 `0700`，host、Node 路径、manifest 与日志文件使用 `0600`，wrapper 使用 `0700`。这样 Native Host 的运行元数据与 ACP 子进程输出只对当前用户可见。结构化 Host 日志不记录消息正文或原始 request ID；扩展 origin、事件名、PID、状态和错误码仍会保留用于诊断。Windows 使用当前用户目录和 HKCU 注册，访问控制沿用当前用户配置目录的 ACL。

Native host 收到请求后会自行再次检测 health；服务健康时直接复用，服务不可用时与直接 fallback 共用用户目录下的原子启动租约。只有租约持有者可以创建不带 CORS/Trusted Host 覆盖参数的 `npx -y @axhub/acp@latest` 进程，其他请求等待同一 health 结果，不得重复启动。health 就绪后，Native host 另起轻量 worker 执行官方 `trusted-host add`，仅追加当前精确 origin。它不运行 Skill，不执行注册、权限修复或脚本注入，也不修改 ACP 默认 CORS 列表。页面 Runtime 或启动脚本的注入只由 Skill/AI 负责；ACP UI 和 Native host 都不得向扩展注入脚本。

注册后的运行日志位于 `~/.axhub/acp-native-host/logs/`（Windows 为 `%LOCALAPPDATA%\Axhub\acp-native-host\logs\`）：`wrapper.log` 记录浏览器调用 wrapper，`native-host.log` 记录结构化协议与启动事件，`acp-ui.log` 记录 NPX/ACP UI 子进程输出。Native Messaging stdout 始终只写长度前缀帧，不写诊断文本；排障时优先检查这些文件和 doctor 的 `host.logs` 项。

## Doctor

默认 doctor 只读：

```bash
node "<skill-dir>/scripts/doctor.mjs" --json --browser chrome --extension-id <extension-id>
```

需要在 macOS/Linux 收紧 owner-only 权限或更新 `node_path.txt` 时，显式执行：

```bash
node "<skill-dir>/scripts/doctor.mjs" --fix --browser chrome --extension-id <extension-id>
```

`doctor --fix` 不复制 host、不改 manifest 内容、不注册、不提权；它只更新 `node_path.txt`，并在 macOS/Linux 把已有安装目录、host、wrapper、manifest 与日志权限收紧到上文模式。host 缺失或与 Skill 版本不一致时，先重新取得用户确认，再带 `--confirm-native-host-install` 显式执行 `register.mjs`。

诊断或修复完成后重新执行 health 检测。未确认 health 前，不得宣称 ACP UI、AI 能力或 AnnotationSource 编辑已经就绪。
