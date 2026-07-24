# AI 对话与批注执行子流程

当用户要使用或排查 Commentary 的 AI 侧边栏对话、AI 批注执行，或配置对应供应商时，走这里。

## 支持范围

AI 侧边栏对话和 AI 批注执行使用 ACP UI 当前配置；当前支持范围为：

- 默认显示：Claude、Codex、OpenCode
- 可在 ACP UI 供应商设置中启用：Cursor、Qoder、CodeBuddy、Reasonix、Grok Build

## 就绪检查

1. 按主文档确认 ACP UI 健康并保持运行；服务未就绪时停止本流程。
2. 在 ACP UI 供应商设置中启用所选供应商并确认 CLI 版本检测通过；缺失时让用户按官方方式安装。
3. 由用户在供应商软件中完成登录和授权。不要索取或输出任何凭据。
4. 安装、登录或环境发生变化后，重启 ACP UI 并重新检查健康状态。

CLI 版本检测通过不代表账号已授权；只有消息测试或 provider session 收到回复，才算可用。

## 使用与验证

1. 使用所选供应商建立 provider session，并确认能收到正常回复。
2. 执行批注时，再确认真实项目工作目录和页面文件定位，等待任务返回终态；“已提交”不代表执行成功。
3. 批注状态和完成后的清除询问按 `references/comment-processing.md` 处理。
