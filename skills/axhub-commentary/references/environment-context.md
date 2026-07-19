# 页面环境信息子流程

当用户要给页面补定位信息、让调试时能快速找到当前页和对应实现时，走这里。

## 目标

让客户端把“当前页对应哪个文件、在项目里的哪个位置、属于哪个工作区”说清楚，让调试和定位直接命中。

## 基本口径

- 这部分优先按页面侧资源上下文接入，不要求用户安装编辑器包
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

接入位置保持这条口径：

- `window.__COMMENTARY_HOST__`：页面侧推荐声明入口，把 `filePath`、`targetPath`、`projectPath` 写在顶层
- `host.getResourceContext()`：只有当前项目本来就手动初始化 Commentary runtime 时使用，把这些字段写进 `meta`

`url` 不是页面协议核心字段。页面地址默认由运行时从 `window.location.href` 读取，不必当成必填接入项。

## 声明入口

### 1. 页面侧声明时，优先 `window.__COMMENTARY_HOST__`

这是默认做法。

### 2. 可控初始化代码时，用 `host.getResourceContext()`

只有页面自己初始化 Commentary runtime 时才需要。

### 3. 只有静态 HTML 时，再退回 `<meta>` 或 `data-genie-*`

只有前两种都不方便时再用。

## 最佳实践

### 1. 页面协议最简写法

```html
<script>
  window.__COMMENTARY_HOST__ = {
    kind: 'prototype',
    filePath: 'src/prototypes/order-detail/index.tsx',
    targetPath: 'prototypes/order-detail',
    projectPath: '/Users/dev/my-project',
    title: '订单详情页',
  };
</script>
```

### 2. 代码侧最简写法

```ts
createCommentary({
  host: {
    getResourceContext: () => ({
      kind: 'web-page',
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

## 实施提醒

- `filePath`、`targetPath`、`projectPath` 三者要互相对得上
- `title` 能省则省；需要时再补
- 除非确实有明确消费方，否则不要继续加字段
- 当前页没有真实实现文件时，不要硬填
