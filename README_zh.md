# dsh-plugin-guide

**双格式插件开发指导。** 本插件指导 agent 构建**同时兼容两个生态**的插件，单一目录搞定：

- **DSH 静态插件包** —— 通过 `dsh plugin --profile <name> add <spec>` 安装
- **Agent Plugins 1.0** —— `plugin.json` + `skills/`，支持它的客户端（Codex、Cursor、VS Code…）可直接加载
- （加成）**标准 agent skills** —— `npx skills add` 能发现同一个 `skills/` 目录

不是 DSH 专属：本插件自身也支持两种格式安装。

## 安装

```bash
# DSH —— 把指导技能注册进 agent 技能目录
dsh plugin --profile web add <git-url|path|npm-name>

# Agent Plugins 1.0 —— 让兼容客户端指向本目录，或发布它
# 标准 skills
npx skills add <path|git-url>
```

DSH 安装并重启 profile 后，`dsh-plugin-guide` 技能会出现在 agent 的技能目录里；agent 会按它来构建双格式插件。包内自带的 `skills/dsh-plugin-guide/scripts/scaffold.mjs` 一条命令即可生成合法双格式骨架。

## 结构

```
dsh-plugin-guide/
├── package.json       # "dsh": {"bundle": {"patch": "./cordis.patch.yml"}}
├── plugin.json        # Agent Plugins 1.0 清单
├── cordis.patch.yml   # dsh bundle 插入行 (id: dsh-plugin-guide-skill)
├── lib/index.js       # Cordis 入口：把 skills/dsh-plugin-guide/SKILL.md 注册进 ctx.skills
└── skills/dsh-plugin-guide/
    ├── SKILL.md       # 指导正文（唯一内容源）
    ├── references/    # 已核实事实库（事件/服务/Slot/工具/打包/Agent Plugins）
    └── scripts/       # scaffold.mjs —— 双格式骨架生成器
```

## 工作原理

`lib/index.js` 是一个极简 Cordis 插件（`inject: ['skills']`）：读取 `skills/dsh-plugin-guide/SKILL.md`（Agent Skills 格式）并通过 `resourceBase` 注册进 `ctx.skills`，相对引用可正常解析。同一个 `skills/` 目录同时被 Agent Plugins 客户端和 `npx skills` 读取——一份内容源，三套加载器。

## License

MIT
