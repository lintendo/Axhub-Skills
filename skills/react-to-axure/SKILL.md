---
name: react-to-axure
description: "将任意 React 组件/应用改造为 Axure 可导入的原型组件，生成符合规范的配置声明和运行时封装代码。适用于已有 React 项目希望导出为 Axure 交互原型的场景。"
---

# React 导出到 Axure

## 概述

本技能将帮助你把**任意 React 组件或应用**改造为可导入 Axure 原型平台的标准组件。改造完成后，组件将具备：

- **配置面板**：在 Axure 编辑器中提供可视化配置项（颜色、文本、数值等）
- **事件系统**：向 Axure 原型发送自定义事件
- **动作系统**：响应来自 Axure 原型的外部调用
- **变量暴露**：将内部状态暴露给 Axure 原型读取
- **数据接入**：接收来自 Axure 原型的外部数据源

本技能产出两类产物：
1. **配置声明**：5 组常量（EVENT_LIST / ACTION_LIST / VAR_LIST / CONFIG_LIST / DATA_LIST）
2. **运行时封装**：使用 `forwardRef` + `useImperativeHandle` 包装的组件代码

## 何时使用

- 你有一个现成的 React 组件，希望在 Axure 原型中使用
- 你的 React 应用需要与 Axure 原型系统进行双向交互
- 你需要为 React 组件生成标准化的配置面板定义

## 引用文件

本技能附带了完整的类型定义文件，可直接复制到目标项目中使用：

- `references/axure-types.ts`：核心接口（AxureProps、AxureHandle）和工具函数
- `references/config-panel-types.ts`：配置面板组件的完整类型定义

## 改造工作流程

### 第 1 步：分析源组件

分析目标 React 组件的以下方面：

1. **Props 接口**：组件当前接收哪些 props？
2. **内部状态**：有哪些 useState / useReducer 状态需要暴露？
3. **交互行为**：有哪些用户交互事件（click、change、submit 等）？
4. **外部依赖**：组件依赖哪些第三方库？
5. **DOM 操作**：是否直接操作 DOM（如图表库、地图库）？

输出一份改造清单，列出需要映射的 props → config、state → var、callback → event/action。

### 第 2 步：复制类型定义

将 `references/axure-types.ts` 复制到目标项目的公共目录中（如 `src/common/axure-types.ts`）。如果需要配置面板的详细类型，也复制 `references/config-panel-types.ts`。

### 第 3 步：定义接口层

根据分析结果，生成以下 5 组常量定义。

#### 3.1 事件列表 EVENT_LIST

定义组件可以向外触发的事件：

```typescript
import type { EventItem } from './path-to/axure-types';

const EVENT_LIST: EventItem[] = [
  { name: 'onClick', desc: '点击时触发' },
  { name: 'onChange', desc: '值改变时触发，payload 为新值的 JSON 字符串' }
];
```

**规则**：
- `name`：事件名称，建议使用 camelCase
- `desc`：事件描述，说明触发时机
- `payload`：可选，描述 payload 的格式（payload **必须是字符串类型**，复杂数据需要 `JSON.stringify`）

#### 3.2 动作列表 ACTION_LIST

定义组件可以响应的外部调用：

```typescript
import type { Action } from './path-to/axure-types';

const ACTION_LIST: Action[] = [
  { name: 'reset', desc: '重置组件到初始状态' },
  { name: 'setValue', desc: '设置值，参数格式：JSON 字符串', params: 'JSON string' }
];
```

**规则**：
- `params` **必须是字符串类型**，复杂参数需要 `JSON.parse` 解析
- `desc` 应说明参数格式

#### 3.3 变量列表 VAR_LIST

定义组件暴露的内部状态：

```typescript
import type { KeyDesc } from './path-to/axure-types';

const VAR_LIST: KeyDesc[] = [
  { name: 'current_value', desc: '当前值' },
  { name: 'is_loading', desc: '是否加载中' }
];
```

**规则**：
- `name` **必须使用 snake_case**（小写字母 + 数字 + 下划线）
- 只暴露外部需要读取的状态，不要暴露内部实现细节

#### 3.4 配置项列表 CONFIG_LIST

定义配置面板中的可配置项：

```typescript
import type { ConfigItem } from './path-to/axure-types';

const CONFIG_LIST: ConfigItem[] = [
  {
    type: 'input',
    attributeId: 'title',
    displayName: '标题',
    info: '组件顶部显示的标题文本',
    initialValue: '默认标题'
  },
  {
    type: 'colorPicker',
    attributeId: 'primaryColor',
    displayName: '主色调',
    info: '组件的主题颜色',
    initialValue: '#1890ff'
  },
  {
    type: 'inputNumber',
    attributeId: 'maxCount',
    displayName: '最大数量',
    info: '允许的最大数量',
    initialValue: 10,
    min: 1,
    max: 100
  },
  {
    type: 'switch',
    attributeId: 'showBorder',
    displayName: '显示边框',
    info: '是否显示组件边框',
    initialValue: true
  },
  {
    type: 'select',
    attributeId: 'size',
    displayName: '尺寸',
    info: '组件尺寸',
    initialValue: 'medium',
    options: [
      { label: '小', value: 'small' },
      { label: '中', value: 'medium' },
      { label: '大', value: 'large' }
    ]
  }
];
```

**可用 type**（详细定义见 `references/config-panel-types.ts`）：

| type | 用途 | initialValue 类型 |
|------|------|-------------------|
| `input` | 文本输入 | `string` |
| `inputNumber` | 数字输入（支持 min/max/step） | `number` |
| `checkbox` | 勾选框 | `boolean` |
| `switch` | 开关 | `boolean` |
| `slider` | 滑块（需要 min/max） | `number` |
| `select` | 下拉选择（需要 options） | `string \| number` |
| `colorPicker` | 颜色选择器 | `string`（HEX 格式） |
| `autoComplete` | 自动完成输入 | `string` |
| `arrayData` | 数组数据编辑器 | `string[]` |
| `table` | 表格数据编辑器 | `any[]` |
| `map` | 键值对编辑器 | `Record<string, any>` |
| `fontSetting` | 字体设置（颜色/大小/粗细等） | 对象 |
| `lineSetting` | 线条设置 | 对象 |
| `group` | 分组容器（包含 children） | — |
| `collapse` | 折叠面板容器 | — |

**映射策略（原始 Props → ConfigItem）**：

| 原始 Props 类型 | 推荐 ConfigItem type |
|---------|------|
| `string` | `input` |
| `number` | `inputNumber` |
| `boolean` | `switch` 或 `checkbox` |
| `enum / union` | `select`（将枚举值映射为 options） |
| 颜色字符串 | `colorPicker` |
| `string[]` | `arrayData` |
| 复杂对象/数组 | `table` 或 `map` |

#### 3.5 数据项列表 DATA_LIST

定义组件接收的外部数据结构：

```typescript
import type { DataDesc } from './path-to/axure-types';

const DATA_LIST: DataDesc[] = [
  {
    name: 'items',
    desc: '列表数据',
    keys: [
      { name: 'id', desc: '唯一标识' },
      { name: 'title', desc: '标题' },
      { name: 'value', desc: '值' }
    ]
  }
];
```

**适用场景**：适用于列表、表格等数据驱动型组件。纯展示或配置驱动的组件可以设为空数组 `[]`。

### 第 4 步：封装组件

将原始组件用 `forwardRef` + `useImperativeHandle` 包装：

```typescript
import React, { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import type { AxureProps, AxureHandle } from './path-to/axure-types';

const WrappedComponent = forwardRef<AxureHandle, AxureProps>(
  function WrappedComponent(innerProps, ref) {
    // ① 安全解构 props（防御性编程）
    const dataSource = innerProps && innerProps.data ? innerProps.data : {};
    const configSource = innerProps && innerProps.config ? innerProps.config : {};
    const onEventHandler = typeof innerProps.onEvent === 'function'
      ? innerProps.onEvent
      : function () { return undefined; };
    const container = innerProps && innerProps.container ? innerProps.container : null;

    // ② 从 config 读取配置值（使用类型检查，避免 || 运算符）
    const title = typeof configSource.title === 'string' && configSource.title
      ? configSource.title
      : '默认标题';
    const maxCount = typeof configSource.maxCount === 'number'
      ? configSource.maxCount
      : 10;

    // ③ 组件内部状态
    const countState = useState(0);
    const count = countState[0];
    const setCount = countState[1];

    // ④ 事件触发（payload 必须是字符串）
    const emitEvent = useCallback(function (eventName: string, payload?: string) {
      try {
        onEventHandler(eventName, payload);
      } catch (error) {
        console.warn('事件触发失败:', eventName, error);
      }
    }, [onEventHandler]);

    // ⑤ 动作处理（params 必须是字符串）
    const handleAction = useCallback(function (name: string, params?: string) {
      switch (name) {
        case 'reset':
          setCount(0);
          break;
        case 'setValue':
          if (params) {
            try {
              const parsed = JSON.parse(params);
              if (typeof parsed.count === 'number') {
                setCount(parsed.count);
              }
            } catch (e) {
              console.warn('参数解析失败:', e);
            }
          }
          break;
      }
    }, []);

    // ⑥ 暴露 Handle 接口
    useImperativeHandle(ref, function () {
      return {
        getVar: function (name: string) {
          const vars: Record<string, any> = {
            current_value: count,
          };
          return vars[name];
        },
        fireAction: handleAction,
        eventList: EVENT_LIST,
        actionList: ACTION_LIST,
        varList: VAR_LIST,
        configList: CONFIG_LIST,
        dataList: DATA_LIST
      };
    }, [count, handleAction]);

    // ⑦ 渲染原始组件（透传改造后的 props）
    return <OriginalComponent title={title} maxCount={maxCount} />;
  }
);

export default WrappedComponent;
```

### 第 5 步：适配构建输出

构建产物必须符合以下要求：

- **输出格式**：IIFE（立即执行函数），全局变量名为 `UserComponent`
- **外部化依赖**：React 和 ReactDOM 必须外部化，不打包进产物
- **单文件输出**：最终产物为单个 JS 文件 + 可选的 CSS 文件

Vite 构建配置示例：

```javascript
// vite.config.js
export default {
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: 'UserComponent',
      formats: ['iife'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
};
```

### 第 6 步：验证清单

改造完成后，逐项检查：

- [ ] 组件使用 `forwardRef<AxureHandle, AxureProps>` 包装
- [ ] `useImperativeHandle` 正确暴露了所有 5 个列表（eventList, actionList, varList, configList, dataList）
- [ ] `export default` 导出封装后的组件
- [ ] 所有 event payload 都是 **字符串类型**
- [ ] 所有 action params 都是 **字符串类型**
- [ ] VAR_LIST 中的 name 使用 **snake_case**
- [ ] CONFIG_LIST 中的每个项都有 `type`、`attributeId`、`displayName`、`initialValue`
- [ ] props 解构使用防御性编程（`innerProps && innerProps.xxx`），不使用 ES6 解构
- [ ] config 值读取使用类型检查，不使用 `||` 运算符（避免 `0`/`false` 被误判）
- [ ] 构建产物格式为 IIFE，全局变量名为 `UserComponent`
- [ ] React/ReactDOM 已外部化，不重复打包

## 改造示例

### 示例 1：简单展示组件

**改造前**（原始 React 组件）：

```tsx
function StatusCard({ title, status, color }) {
  return (
    <div style={{ borderLeft: `4px solid ${color}` }}>
      <h3>{title}</h3>
      <span>{status}</span>
    </div>
  );
}
```

**改造后**（Axure 兼容组件）：

```tsx
import React, { forwardRef, useImperativeHandle } from 'react';
import type { AxureProps, AxureHandle, EventItem, Action, KeyDesc, ConfigItem, DataDesc } from './path-to/axure-types';

const EVENT_LIST: EventItem[] = [];
const ACTION_LIST: Action[] = [];
const VAR_LIST: KeyDesc[] = [
  { name: 'current_status', desc: '当前状态文本' }
];
const CONFIG_LIST: ConfigItem[] = [
  { type: 'input', attributeId: 'title', displayName: '标题', initialValue: '状态卡片' },
  { type: 'input', attributeId: 'status', displayName: '状态', initialValue: '正常' },
  { type: 'colorPicker', attributeId: 'color', displayName: '状态颜色', initialValue: '#52c41a' }
];
const DATA_LIST: DataDesc[] = [];

const Component = forwardRef<AxureHandle, AxureProps>(function StatusCard(innerProps, ref) {
  const configSource = innerProps && innerProps.config ? innerProps.config : {};
  const title = typeof configSource.title === 'string' && configSource.title ? configSource.title : '状态卡片';
  const status = typeof configSource.status === 'string' && configSource.status ? configSource.status : '正常';
  const color = typeof configSource.color === 'string' && configSource.color ? configSource.color : '#52c41a';

  useImperativeHandle(ref, function () {
    return {
      getVar: function (name: string) { return name === 'current_status' ? status : undefined; },
      fireAction: function () {},
      eventList: EVENT_LIST,
      actionList: ACTION_LIST,
      varList: VAR_LIST,
      configList: CONFIG_LIST,
      dataList: DATA_LIST
    };
  }, [status]);

  return (
    <div style={{ borderLeft: '4px solid ' + color, padding: '12px' }}>
      <h3>{title}</h3>
      <span>{status}</span>
    </div>
  );
});

export default Component;
```

### 示例 2：交互型组件（带事件和动作）

**改造前**：

```tsx
function Counter({ initial = 0, onCountChange }) {
  const [count, setCount] = useState(initial);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => { setCount(c => c + 1); onCountChange?.(count + 1); }}>+1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}
```

**改造后**：

```tsx
import React, { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import type { AxureProps, AxureHandle, EventItem, Action, KeyDesc, ConfigItem, DataDesc } from './path-to/axure-types';

const EVENT_LIST: EventItem[] = [{ name: 'onCountChange', desc: '计数改变时触发' }];
const ACTION_LIST: Action[] = [
  { name: 'increment', desc: '计数 +1' },
  { name: 'reset', desc: '重置计数' },
  { name: 'setCount', desc: '设置计数值，参数：数字字符串', params: 'number string' }
];
const VAR_LIST: KeyDesc[] = [{ name: 'count', desc: '当前计数值' }];
const CONFIG_LIST: ConfigItem[] = [
  { type: 'inputNumber', attributeId: 'initial', displayName: '初始值', initialValue: 0, min: 0 }
];
const DATA_LIST: DataDesc[] = [];

const Component = forwardRef<AxureHandle, AxureProps>(function Counter(innerProps, ref) {
  const configSource = innerProps && innerProps.config ? innerProps.config : {};
  const onEventHandler = typeof innerProps.onEvent === 'function'
    ? innerProps.onEvent : function () {};
  const initial = typeof configSource.initial === 'number' ? configSource.initial : 0;

  const countState = useState(initial);
  const count = countState[0];
  const setCount = countState[1];

  const emitEvent = useCallback(function (eventName: string, payload?: string) {
    try { onEventHandler(eventName, payload); } catch (e) { console.warn(e); }
  }, [onEventHandler]);

  const increment = useCallback(function () {
    setCount(function (prev) {
      var next = prev + 1;
      emitEvent('onCountChange', String(next));
      return next;
    });
  }, [emitEvent]);

  const reset = useCallback(function () {
    setCount(initial);
    emitEvent('onCountChange', String(initial));
  }, [initial, emitEvent]);

  const handleAction = useCallback(function (name: string, params?: string) {
    switch (name) {
      case 'increment': increment(); break;
      case 'reset': reset(); break;
      case 'setCount':
        if (params) {
          var n = parseInt(params, 10);
          if (!isNaN(n)) { setCount(n); emitEvent('onCountChange', String(n)); }
        }
        break;
    }
  }, [increment, reset, emitEvent]);

  useImperativeHandle(ref, function () {
    return {
      getVar: function (name: string) { return name === 'count' ? count : undefined; },
      fireAction: handleAction,
      eventList: EVENT_LIST,
      actionList: ACTION_LIST,
      varList: VAR_LIST,
      configList: CONFIG_LIST,
      dataList: DATA_LIST
    };
  }, [count, handleAction]);

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+1</button>
      <button onClick={reset}>重置</button>
    </div>
  );
});

export default Component;
```

### 示例 3：数据驱动型组件

**改造前**：

```tsx
function UserList({ users, onSelect }) {
  return (
    <ul>
      {users.map(u => (
        <li key={u.id} onClick={() => onSelect(u)}>
          {u.name} - {u.email}
        </li>
      ))}
    </ul>
  );
}
```

**改造后**：

```tsx
import React, { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import type { AxureProps, AxureHandle, EventItem, Action, KeyDesc, ConfigItem, DataDesc } from './path-to/axure-types';

const EVENT_LIST: EventItem[] = [{ name: 'onSelect', desc: '选中用户时触发，payload 为用户 JSON' }];
const ACTION_LIST: Action[] = [{ name: 'clearSelection', desc: '清除选中' }];
const VAR_LIST: KeyDesc[] = [{ name: 'selected_user_id', desc: '当前选中的用户 ID' }];
const CONFIG_LIST: ConfigItem[] = [
  { type: 'input', attributeId: 'emptyText', displayName: '空状态文本', initialValue: '暂无数据' }
];
const DATA_LIST: DataDesc[] = [
  {
    name: 'users',
    desc: '用户列表数据',
    keys: [
      { name: 'id', desc: '用户 ID' },
      { name: 'name', desc: '用户姓名' },
      { name: 'email', desc: '用户邮箱' }
    ]
  }
];

const Component = forwardRef<AxureHandle, AxureProps>(function UserList(innerProps, ref) {
  const dataSource = innerProps && innerProps.data ? innerProps.data : {};
  const configSource = innerProps && innerProps.config ? innerProps.config : {};
  const onEventHandler = typeof innerProps.onEvent === 'function'
    ? innerProps.onEvent : function () {};
  const emptyText = typeof configSource.emptyText === 'string' && configSource.emptyText
    ? configSource.emptyText : '暂无数据';
  var users = Array.isArray(dataSource.users) ? dataSource.users : [];

  const selectedState = useState<string | null>(null);
  const selectedId = selectedState[0];
  const setSelectedId = selectedState[1];

  const emitEvent = useCallback(function (eventName: string, payload?: string) {
    try { onEventHandler(eventName, payload); } catch (e) { console.warn(e); }
  }, [onEventHandler]);

  const handleAction = useCallback(function (name: string) {
    if (name === 'clearSelection') setSelectedId(null);
  }, []);

  useImperativeHandle(ref, function () {
    return {
      getVar: function (name: string) { return name === 'selected_user_id' ? selectedId : undefined; },
      fireAction: handleAction,
      eventList: EVENT_LIST,
      actionList: ACTION_LIST,
      varList: VAR_LIST,
      configList: CONFIG_LIST,
      dataList: DATA_LIST
    };
  }, [selectedId, handleAction]);

  if (users.length === 0) return <div>{emptyText}</div>;

  return (
    <ul>
      {users.map(function (u: any) {
        return (
          <li key={u.id} onClick={function () {
            setSelectedId(u.id);
            emitEvent('onSelect', JSON.stringify(u));
          }}>
            {u.name} - {u.email}
          </li>
        );
      })}
    </ul>
  );
});

export default Component;
```

## 常见问题

### Q: 组件使用了图表库（ECharts、D3）等直接操作 DOM 的库怎么办？

使用 `innerProps.container` 获取 DOM 容器，在 `useEffect` 中初始化图表引擎：

```typescript
const container = innerProps && innerProps.container ? innerProps.container : null;

useEffect(function () {
  if (!container) return;
  const chart = echarts.init(container);
  chart.setOption({ /* ... */ });
  return function () { chart.dispose(); };
}, [container]);

return null; // 直接使用 container 渲染时返回 null
```

### Q: 组件的 props 很复杂（嵌套对象），如何映射到 CONFIG_LIST？

- **扁平化**：将嵌套属性用 `attributeId` 的点分隔路径表示，如 `'style.fontSize'`
- **分组**：使用 `type: 'group'` 或 `type: 'collapse'` 组织相关配置项
- **复杂结构**：使用 `table` 或 `map` 类型编辑器

### Q: 原始组件用了 props 解构、箭头函数，需要改写吗？

建议改写以提升兼容性：
- 使用 `function` 关键字替代箭头函数
- 使用 `innerProps && innerProps.xxx` 替代解构（防御性编程）
- 使用 `useState` 返回值的数组索引访问而非解构

### Q: 如何处理组件的样式？

- 将 CSS 放在同目录的 `style.css` 中并 `import './style.css'`
- 使用带组件前缀的类名避免全局冲突（如 `my-chart-container`）
- 避免全局样式污染

## 类型参考

完整的类型定义见本技能的 `references/` 目录：

- **`references/axure-types.ts`**：核心接口和工具函数
  - `AxureProps`：组件 Props 接口（data、config、onEvent、container）
  - `AxureHandle`：组件 Handle 接口（getVar、fireAction、5 个列表）
  - `EventItem`：事件定义 `{ name, desc, payload? }`
  - `Action`：动作定义 `{ name, desc, params? }`
  - `KeyDesc`：变量/数据字段定义 `{ name, desc }`（name 必须 snake_case）
  - `DataDesc`：数据源定义 `{ name, desc, keys: KeyDesc[] }`
  - `ConfigItem`：配置面板项定义
  - `safeEmitEvent`、`createEventEmitter`：事件触发工具函数
  - `getConfigValue`、`getDataValue`：安全取值工具函数

- **`references/config-panel-types.ts`**：配置面板组件详细类型
  - `InputConfig`、`InputNumberConfig`、`CheckboxConfig`、`SliderConfig`
  - `SelectConfig`、`AutoCompleteConfig`、`ColorPickerConfig`
  - `ArrayDataConfig`、`TableConfig`、`MapConfig`
  - `FontSettingConfig`、`LineSettingConfig`、`PointSettingConfig`
  - `GroupConfig`：分组布局
