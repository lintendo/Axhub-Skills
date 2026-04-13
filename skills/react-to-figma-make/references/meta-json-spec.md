# meta.json 规范

## 完整字段定义

```typescript
interface MetaJson {
  /** 页面渲染的客户端元数据 */
  client_meta: {
    /** 画布背景颜色（RGBA 0-1 范围） */
    background_color: {
      r: number;  // 0.0 ~ 1.0
      g: number;  // 0.0 ~ 1.0
      b: number;  // 0.0 ~ 1.0
      a: number;  // 0.0 ~ 1.0（通常为 1）
    };

    /** 缩略图尺寸（像素） */
    thumbnail_size: {
      width: number;   // 建议 400
      height: number;  // 建议 300
    };

    /** 页面渲染坐标和尺寸（像素） */
    render_coordinates: {
      x: number;       // 起始 X 坐标（通常为 0）
      y: number;       // 起始 Y 坐标（通常为 0）
      width: number;   // 页面宽度（如 1280、1440、375）
      height: number;  // 页面高度（如 960、900、812）
    };
  };

  /** 项目显示名称，也是最终导出的 .fig 文件名 */
  file_name: string;

  /** 开发者相关链接（通常为空数组） */
  developer_related_links: Array<{
    url: string;
    label?: string;
  }>;

  /** 最后导出时间（ISO 8601 格式） */
  exported_at: string;
}
```

## 示例

### 常规桌面页面

```json
{
  "client_meta": {
    "background_color": { "r": 0.96, "g": 0.96, "b": 0.96, "a": 1 },
    "thumbnail_size": { "width": 400, "height": 300 },
    "render_coordinates": { "x": 0, "y": 0, "width": 1280, "height": 960 }
  },
  "file_name": "我的页面",
  "developer_related_links": [],
  "exported_at": "2026-04-13T03:00:00.000Z"
}
```

### 移动端页面

```json
{
  "client_meta": {
    "background_color": { "r": 1, "g": 1, "b": 1, "a": 1 },
    "thumbnail_size": { "width": 400, "height": 300 },
    "render_coordinates": { "x": 0, "y": 0, "width": 375, "height": 812 }
  },
  "file_name": "移动端首页",
  "developer_related_links": [],
  "exported_at": "2026-04-13T03:00:00.000Z"
}
```

### 宽屏仪表盘

```json
{
  "client_meta": {
    "background_color": { "r": 0.06, "g": 0.06, "b": 0.09, "a": 1 },
    "thumbnail_size": { "width": 400, "height": 225 },
    "render_coordinates": { "x": 0, "y": 0, "width": 1920, "height": 1080 }
  },
  "file_name": "数据仪表盘",
  "developer_related_links": [],
  "exported_at": "2026-04-13T03:00:00.000Z"
}
```

## 字段说明

### `background_color`

画布的背景颜色，使用 0-1 范围的 RGBA 值。

常用预设：

| 场景 | R | G | B | A |
|------|---|---|---|---|
| 浅灰背景（默认） | 0.96 | 0.96 | 0.96 | 1 |
| 纯白背景 | 1 | 1 | 1 | 1 |
| 深色背景 | 0.06 | 0.06 | 0.09 | 1 |
| 透明 | 0 | 0 | 0 | 0 |

### `render_coordinates`

页面的画布渲染区域。决定了 Figma Make 中的视口大小。

常用预设：

| 设备类型 | width | height |
|----------|-------|--------|
| 桌面（标准） | 1280 | 960 |
| 桌面（宽屏） | 1440 | 900 |
| 桌面（全高清） | 1920 | 1080 |
| 平板 | 768 | 1024 |
| iPhone | 375 | 812 |
| Android | 360 | 800 |

### `file_name`

最终导出的 `.fig` 文件显示名称。支持中文和空格。

### `exported_at`

使用 ISO 8601 格式。每次重新 pack 导出时应更新为当前时间。

```javascript
// 时间戳生成
new Date().toISOString()
// => "2026-04-13T03:00:00.000Z"
```
