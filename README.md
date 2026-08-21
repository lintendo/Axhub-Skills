# Axhub AI Skills

Axhub 出品的 AI Skills 集合，帮助产品经理、设计师和研发把原型、页面、用户反馈与设计稿交给 AI 理解并继续完成工作。

> 建议每次只安装当前任务需要的一个技能。先从总览找到合适的技能，再查看对应的使用场景和安装提示词。

## 技能总览

| 技能 | 一句话用途 |
| --- | --- |
| [`axhub-annotation-standalone`](#axhub-annotation-standalone) | 让原型同时展示页面标注、PRD 目录和说明文档 |
| [`axhub-prototype-context`](#axhub-prototype-context) | 让 AI 读取带标注原型的页面、PRD、标注和源码 |
| [`extract-axure-data`](#extract-axure-data) | 读取 Axure 原型的页面、交互、标注和视觉信息 |
| [`search-design-system`](#search-design-system) | 从现有设计知识中检索并比较合适的设计系统或主题 |
| [`build-design-system`](#build-design-system) | 把参考页面整理成可复用的设计规范和项目主题 |
| [`axhub-commentary`](#axhub-commentary) | 读取页面批注、完成修改并同步处理状态 |
| [`figma-content-operator`](#figma-content-operator) | 让 AI 读取、修改、导出 Figma 内容并关联项目代码 |
| [`extract-page-data`](#extract-page-data) | 把普通网页整理成截图、文案、颜色、字体和链接资料 |
| [`clone-page`](#clone-page) | 根据参考网页还原一个可以继续修改和开发的页面 |
| [`china-customer-research`](#china-customer-research) | 从真实用户反馈中找到需求、动机和决策依据 |
| [`react-to-figma-make`](#react-to-figma-make) | 把已有产品页面转换为 Figma Make 可继续编辑的文件 |
| [`git-repo-beginner-guide`](#git-repo-beginner-guide) | 帮助不熟悉 Git 的用户安全保存、同步和恢复项目 |

## 技能说明

<a id="axhub-annotation-standalone"></a>
### `axhub-annotation-standalone`：在原型中展示标注和 PRD

**遇到的问题 / 适用场景**

- 希望用可交互原型代替传统 PRD，让页面和需求说明放在一起。
- 分享原型时，希望其他人能同步看到页面目录、PRD 文档和具体位置的标注。
- 原型有多个页面或状态，希望查看者可以跟着标注切换并理解完整流程。

**解决方法**

使用 `axhub-annotation-standalone`，把已有的目录、PRD 和页面标注展示在原型中，让查看者边操作边理解需求。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/axhub-annotation-standalone 安装 axhub-annotation-standalone 这个技能。
```

<a id="axhub-prototype-context"></a>
### `axhub-prototype-context`：读取带标注的原型

**遇到的问题 / 适用场景**

- 拿到一个带标注的原型链接，希望 AI 不只看截图，还能理解页面目录、PRD 和每条标注。
- 希望 AI 同时读取原型对应的源码，了解设计与现有实现之间的关系。
- 原型已经说明清楚需求，希望 AI Agent 继续完成评审、开发计划或生产环境实现。

**解决方法**

使用 `axhub-prototype-context`，读取原型公开的页面、PRD、标注和源码信息，并把这些内容作为 AI Agent 后续工作的完整上下文。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/axhub-prototype-context 安装 axhub-prototype-context 这个技能。
```

<a id="extract-axure-data"></a>
### `extract-axure-data`：读取 Axure 原型

**遇到的问题 / 适用场景**

- 手上只有一个 Axure 原型链接，希望 AI 理解其中有哪些页面和完整流程。
- 需要整理原型中的页面截图、交互效果、设计标注和文案。
- 希望依据现有 Axure 原型继续做评审、改版，或把它实现成真正的产品页面。

**解决方法**

使用 `extract-axure-data`，把 Axure 原型中的页面、交互、标注、文案和视觉信息整理成 AI 可以继续使用的资料。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/extract-axure-data 安装 extract-axure-data 这个技能。
```

<a id="build-design-system"></a>
### `build-design-system`：从参考页面构建设计系统

**遇到的问题 / 适用场景**

- 找到了喜欢的参考页面，但没有现成的颜色、字体、间距和组件规范。
- 希望新页面保持统一风格，避免不同页面看起来像来自不同产品。
- 需要一份设计师能检查、研发和 AI 能直接使用的设计规范。

**解决方法**

使用 `build-design-system`，分析参考页面的视觉规律，生成 `DESIGN.md` 设计规范和可以直接用于项目的 Tailwind v4 主题。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/build-design-system 安装 build-design-system 这个技能。
```

<a id="search-design-system"></a>
### `search-design-system`：选择现有设计系统或主题

**遇到的问题 / 适用场景**

- 产品或页面还没有确定设计基底，希望先比较已有方案。
- 需要按平台、行业、页面类型和风格筛选设计知识。
- 希望先读取候选的 `DESIGN.md` 和预览，再决定采用哪个主题。

**解决方法**

使用 `search-design-system`，从 Axhub 设计知识索引中检索候选并比较设计规范；它不负责创建或修改主题。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/search-design-system 安装 search-design-system 这个技能。
```

<a id="axhub-commentary"></a>
### `axhub-commentary`：根据页面批注完成改稿

**遇到的问题 / 适用场景**

- 页面已经收到 Axhub Commentary 批注，希望 AI 按意见直接完成修改。
- 批注较多，需要知道哪些已经处理、哪些仍需确认，并保持状态同步。
- 希望在页面上继续添加或修改标注，或比较多个调整方案。

**解决方法**

使用 `axhub-commentary`，读取页面批注、完成对应修改并更新处理状态，也可以继续准备可批注页面和标注编辑环境。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/axhub-commentary 安装 axhub-commentary 这个技能。
```

<a id="figma-content-operator"></a>
### `figma-content-operator`：让 AI 操作 Figma 内容

**遇到的问题 / 适用场景**

- 希望 AI 看懂当前选中的 Figma 图层、文字、颜色、布局和组件关系。
- 需要批量修改文字、样式、变量或页面内容，并在修改后检查结果。
- 希望导出图片、PDF 或设计资料，或把 Figma 设计与现有项目代码对应起来。
- Figma 文件需要生成可批注链接，并关联当前项目目录。

**解决方法**

使用 `figma-content-operator`，让 AI 按当前任务读取、修改和导出 Figma 内容；需要页面批注时可与 `axhub-commentary` 一起使用。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/figma-content-operator 安装 figma-content-operator 这个技能。
```

<a id="extract-page-data"></a>
### `extract-page-data`：整理网页内容和视觉资料

**遇到的问题 / 适用场景**

- 手上只有一个网页链接，希望完整保存页面或某个区域的画面。
- 需要整理页面使用的颜色、字体、文案、链接和可点击内容。
- 希望把网页快速转成便于分析、汇报或继续开发的资料包。

**解决方法**

使用 `extract-page-data`，从普通网页中提取截图、视觉风格、页面文案和链接，并按任务需要整理输出。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/extract-page-data 安装 extract-page-data 这个技能。
```

<a id="clone-page"></a>
### `clone-page`：还原参考网页

**遇到的问题 / 适用场景**

- 想参考一个现有网页快速制作自己的页面，不希望从空白开始。
- 参考页面在电脑和手机上有不同布局，或包含悬停、点击等状态。
- 希望保留页面中的图片、字体和图标，并逐步检查还原效果。

**解决方法**

使用 `clone-page`，分析参考网页的内容、布局、不同尺寸和交互状态，再还原成可以继续修改和开发的页面。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/clone-page 安装 clone-page 这个技能。
```

<a id="china-customer-research"></a>
### `china-customer-research`：从用户反馈中发现需求

**遇到的问题 / 适用场景**

- 有很多访谈、问卷、工单、社区帖子或评论，不知道用户真正关心什么。
- 需要理解用户为什么购买、持续使用或放弃产品。
- 希望比较中国、海外或不同市场的用户需求，为产品决策和 PRD 找到证据。

**解决方法**

使用 `china-customer-research`，根据研究市场整理真实用户反馈，归纳核心需求、使用动机和可以追溯的产品依据。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/china-customer-research 安装 china-customer-research 这个技能。
```

<a id="react-to-figma-make"></a>
### `react-to-figma-make`：把产品页面带回 Figma Make

**遇到的问题 / 适用场景**

- 已经有一个可以运行的产品页面，希望在 Figma Make 中继续编辑、演示或迭代。
- 页面已经更新，希望设计文件中的代码、图片和其他资源也保持同步。
- 需要生成可以直接导入 Figma Make 的 `.fig` 文件，并确认导入后能够正常使用。

**解决方法**

使用 `react-to-figma-make`，把现有产品页面及其资源整理为 Figma Make 可导入、可继续编辑的 `.fig` 文件。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/react-to-figma-make 安装 react-to-figma-make 这个技能。
```

<a id="git-repo-beginner-guide"></a>
### `git-repo-beginner-guide`：安全保存和同步项目

**遇到的问题 / 适用场景**

- 第一次把项目保存到 GitHub、GitLab、Gitee 等平台，不知道从哪里开始。
- 需要提交、下载或同步团队改动，但担心覆盖别人或丢失自己的内容。
- 遇到冲突、误操作或错误版本，希望有人逐步说明并帮助恢复。

**解决方法**

使用 `git-repo-beginner-guide`，通过逐步确认完成项目保存、同步、冲突处理和版本恢复，重要操作不会在未确认时执行。

**安装提示词**

```text
请从 https://github.com/lintendo/Axhub-Skills/tree/main/skills/git-repo-beginner-guide 安装 git-repo-beginner-guide 这个技能。
```
