# skills

`skills` 是 Axhub Runtime 下用于沉淀和管理 Skill 版本资源的独立项目目录。

当前目录结构参考 [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) 的组织方式，用于独立沉淀和管理 Skill 版本资源。

## 当前目录结构

```text
skills/
├── README.md
└── skills/
    ├── mcp-installer/
    │   ├── SKILL.md
    │   └── references/
    └── react-to-axure/
        └── SKILL.md
```

## 约定

- 具体技能后续统一放在 `skills/` 目录下
- 当前已迁入 `mcp-installer` 技能
- 当前暂不添加 `package.json`
- 当前暂不添加 `scripts/` 目录

后续如果开始沉淀技能，可以按 `skills/<skill-name>/SKILL.md` 的形式逐步扩展。
