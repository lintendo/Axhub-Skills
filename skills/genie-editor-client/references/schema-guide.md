# Schema 参考

整理 `@axhub/genie-editor-client` / tweak protocol 里当前可用的字段类型，以及常见使用场景。

## 基本结构

- `schema.title`：当前属性组标题
- `schema.description`：当前属性组说明
- `fields[]`：字段列表
- `values`：当前值
- `update`：回写 patch

常用字段属性：

- `key`
- `label`
- `type`
- `description`
- `placeholder`
- `min` / `max` / `step`
- `options`

## 字段类型

| 类型 | 推荐场景 | 备注 |
|------|------|------|
| `text` | 标题、副标题、按钮文案、短说明 | 不适合一次性改稿和大段富文本 |
| `number` | 数值配置、列数、条目数、固定尺寸参数 | 不适合需要拖动手感的连续调节 |
| `slider` | 连续范围调节、透明度、缩放、密度 | 建议搭配 `min` / `max` / `step` |
| `select` | 枚举选项、variant、size、theme、布局模式 | 适合选项清楚且只有一个值生效 |
| `card` | 多方案比稿、布局方向切换、风格方向切换、带标题和描述的单选方案 | `options[]` 建议包含 `label`、`description`、`value` |
| `checkbox` | 多选项开关、一组可并存能力 | 只有字段本身确实是多选时再用 |
| `switch` | 开 / 关、是否显示、是否启用、是否折叠 | 适合明确布尔态，不要拿来表达多档状态 |
| `color` | 主题色、强调色、图表主色 | 优先暴露设计系统颜色或语义色 |

## 推荐选型

- 文本配置优先 `text`
- 布尔状态优先 `switch`
- 离散枚举优先 `select`
- 多方向单选优先 `card`
- 连续数值优先 `slider`
- 普通数值优先 `number`
