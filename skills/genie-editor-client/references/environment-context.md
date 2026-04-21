# 页面环境信息子流程

当用户要给页面补定位信息、让调试时能快速找到当前页和对应实现时，走这里。

## 目标

让客户端把“当前页对应哪个文件、在项目里的哪个位置、属于哪个工作区”说清楚，让调试和定位直接命中。

## 基本口径

- 应用层按最小参数接入，不展开全量协议
- 默认只写 `filePath`、`targetPath`、`projectPath`
- `title` 只有在页面很多、需要更快识别时再补
- 不要展示兼容字段，不要堆调试噪音
- 不要为了“完整”伪造路径

## 最小参数

- `filePath`：当前实现文件
- `targetPath`：项目内相对路径
- `projectPath`：项目根路径
- `title`：可选，给人看的页面名

够用时就停，不要继续往里塞更多字段。

## 声明入口

### 1. 可控初始化代码时，优先 `host.getResourceContext()`

这是默认做法。

### 2. 只能走开放协议时，用 `window.__GENIE_EDITOR_HOST__`

这是页面侧最简声明入口。

### 3. 只有静态 HTML 时，再退回 `<meta>` 或 `data-genie-*`

只有前两种都不方便时再用。

## 最佳实践

### 1. 代码侧最简写法

```ts
createGenieEditor({
  host: {
    getResourceContext: () => ({
      kind: 'web-page',
      url: window.location.href,
      meta: {
        filePath: 'src/components/button-demo/index.tsx',
        targetPath: 'components/button-demo',
        projectPath: '/Users/dev/my-project',
        title: 'Button Demo',
      },
    }),
  },
});
```

### 2. 页面协议最简写法

```html
<script>
  window.__GENIE_EDITOR_HOST__ = {
    kind: 'prototype',
    url: window.location.href,
    meta: {
      filePath: 'src/prototypes/order-detail/index.tsx',
      targetPath: 'prototypes/order-detail',
      projectPath: '/Users/dev/my-project',
      title: '订单详情页',
    },
  };
</script>
```

## 实施提醒

- `filePath`、`targetPath`、`projectPath` 三者要互相对得上
- `title` 能省则省；需要时再补
- 除非确实有明确消费方，否则不要继续加字段
- 当前页没有真实实现文件时，不要硬填
