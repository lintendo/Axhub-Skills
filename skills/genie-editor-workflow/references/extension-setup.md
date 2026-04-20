# Chrome 扩展安装与连接检测

## 安装方式

访问 [https://axhub.im/chrome/](https://axhub.im/chrome/)，按页面引导安装 Axhub AI Extension。

## 连接检测清单

### Step 1：确认后端服务在线

```bash
npx @axhub/genie status --json
```

如果 `running: false`，启动服务：
```bash
npx @axhub/genie --cwd /path/to/project
```

### Step 2：确认有在线客户端

```bash
npx @axhub/genie editor clients list
```

Chrome 扩展客户端的特征：
- `source` 字段为 `"chrome-extension"`
- `capabilities` 包含 `editor.snapshot`、`editor.nodes.list`、`editor.node.screenshot`、`editor.context-images`、`editor.editing.set`

### Step 3：目标客户端能力验证

如果 `capabilities` 缺少某些能力，通常是扩展或编辑器版本过旧。引导用户更新扩展到最新版本。

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
