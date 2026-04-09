# Chrome 扩展安装与连接检测

## 安装方式

### 推荐：在线安装

访问 [https://axhub.im/chrome/](https://axhub.im/chrome/)，按页面引导安装 Axhub AI Extension。

### 开发者模式加载

1. 克隆或下载扩展项目源码
2. 执行 `pnpm install && pnpm build`
3. 打开 Chrome → `chrome://extensions/` → 启用「开发者模式」
4. 点击「加载已解压的扩展程序」→ 选择 `dist/` 目录

## 扩展功能概览

| 功能 | 说明 |
|------|------|
| Genie Editor 注入 | 在任意网页上注入可视化编辑器 |
| 元素选择与标注 | 用户在页面上选择元素并添加文字/图片标注 |
| WS 实时通信 | 编辑器与后端服务通过 WebSocket 实时同步 |
| Prompt 生成 | 将标注内容生成结构化提示词 |
| 页面数据导出 | Clone Page Pack（HTML/CSS/截图/主题数据包） |

本技能仅聚焦**快速编辑通信闭环**：读取标注 → 修改代码 → 回写状态。

## 连接检测清单

### Step 1：确认后端服务在线

```bash
npx @axhub/genie status --json
```

预期：
```json
{
  "running": true,
  "port": 32123,
  "endpoint": {
    "apiBaseUrl": "http://localhost:32123/api"
  }
}
```

如果 `running: false`，启动服务：
```bash
npx @axhub/genie --cwd /path/to/project
```

### Step 2：确认有在线客户端

```bash
npx @axhub/genie editor clients list
```

预期至少一个客户端在线。Chrome 扩展客户端的特征：
- `source` 字段为 `"chrome-extension"`
- `capabilities` 包含 `editor.snapshot`、`editor.nodes.list`、`editor.node.screenshot`、`editor.context-images`、`editor.editing.set`

### Step 3：目标客户端能力验证

确认目标客户端具备所需能力后，记录 `channel` 和 `clientId`，进入主流程。

如果 `capabilities` 缺少某些能力，可能是扩展或编辑器版本过旧。引导用户更新扩展到最新版本。

## 常见问题

### Q1：`clients list` 返回空

可能原因：
1. 扩展未安装 → 引导到 [https://axhub.im/chrome/](https://axhub.im/chrome/)
2. 扩展已安装但编辑器未启动 → 点击扩展图标，启动编辑器
3. 目标页面的编辑器已关闭 → 重新打开编辑器
4. 后端服务地址不匹配 → 确认扩展配置的 API Base 与 `status --json` 一致

### Q2：客户端在线但命令报 `UNSUPPORTED_FRONTEND_CAPABILITY`

扩展或编辑器版本过旧。引导用户：
1. 更新扩展到最新版本
2. 刷新目标页面使编辑器重新初始化

### Q3：客户端在线但命令报 `REQUEST_TIMEOUT`

可能是网络延迟或页面加载中。建议：
1. 等待 3-5 秒后重试
2. 确认目标页面没有被浏览器挂起（非活跃标签页可能被冻结）
3. 尝试切换到目标标签页激活后重试

### Q4：如何区分来自 Chrome 扩展和其他宿主的客户端？

`editor clients list` 返回的每个客户端包含 `source` 字段：
- `"chrome-extension"` → 来自 Axhub AI Extension
- `null` 或其他值 → 来自其他宿主应用

### Q5：扩展 WS 断开后如何恢复？

扩展内置了自动重连机制。通常等待几秒后重新运行 `editor clients list` 即可看到客户端恢复在线。

如果长时间未恢复：
1. 检查后端服务是否仍在运行
2. 在目标页面手动刷新
3. 重新启动编辑器
