# Agent Plugins 1.0 规范（agent-plugins-1.0.md）

> Agent Plugins 1.0 是跨生态插件格式（Codex/Cursor/VS Code 等 agent 客户端通用），与 DSH 静态插件包是**两套独立格式**。
> 本分册以 `$schema`（agent-plugins.org 1.0.0）为规范基准，并结合本技能自身 `plugin.json` 实例与 SKILL.md 约定；准确字段以插件实例为准。

## 1. plugin.json schema 字段

本技能 `plugin.json`（真实实例，Agent Plugins 1.0）：

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "dsh-plugin-guide",
  "version": "0.1.0",
  "description": "…双格式插件开发指导…",
  "author": { "name": "贾晓源 (Fectivnfy112357)", "url": "https://github.com/Fectivnfy112357" },
  "homepage": "https://github.com/Fectivnfy112357/dsh-plugin-guide",
  "repository": "https://github.com/Fectivnfy112357/dsh-plugin-guide",
  "license": "MIT",
  "keywords": ["deepseek", "dsh", "dsh-plugin", "agent-plugins", "dual-format", "plugin", "guide"]
}
```

字段说明：
- `$schema` —— 指向 `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`。
- `name` —— 小写字母数字 + `-`/`.`；**不能含 `--` 或 `..`**，不能大写；建议与 npm 包名一致或不冲突。
- `version` —— semver 字符串（如 `0.1.0`）。
- `description` —— 一句话说明（**常被作为 agent 技能 catalog 的 summary**，应准确、含触发词）。
- `author` —— `{ name, url? }` 对象。
- `homepage` / `repository` / `license` / `keywords` —— 可选元数据。

## 2. skills/ 布局规则

- 包根 `skills/` 下**每个含 `SKILL.md` 的子目录即一个技能**：`skills/<name>/SKILL.md`。
- `SKILL.md` 用 Agent Skills 格式，frontmatter **必须含 `name` 和 `description`**（可选 `whenToUse`）。
- 技能正文的相对引用（`references/`、`scripts/`）以技能目录 `skills/<name>/` 为基准解析（AGENTS 语义的 `resourceBase` 目录）；经 DSH 加载时由 `lib/index.js` 传入 `resourceBase: { kind: 'directory', path }`。

```markdown
---
name: my-skill
description: 何时触发、做什么
whenToUse: 用户请求…
---
（正文内容）
```

## 3. mcp.json（可选，有 MCP 服务器才放包根）

每个 server **必须显式声明 type**：`stdio` / `streamable-http` / `sse` 三选一。不需要 MCP 服务器就不放该文件。

```json
{
  "servers": {
    "my-server": { "type": "stdio", "command": "node", "args": ["./bin.mjs"] }
  }
}
```

## 4. 反向域名命名空间

插件 `name`（及技能名）采用**反向域名风格命名空间**：小写 + 点分/连字符，如 `dsh-plugin-guide`、`com.example.my-plugin`。
规则同上：小写字母数字 + `-`/`.`，禁 `--`/`..`/大写。作用：跨生态避免插件/技能名冲突，且与 npm 命名空间一致。

## 5. 与 DSH 的对应关系

| Agent Plugins 1.0 元素 | DSH 静态插件包对应 | 说明 |
|---|---|---|
| `plugin.json` | `package.json`（`dsh.bundle.patch`） | 两套清单并存，互不替代 |
| `skills/<name>/SKILL.md` | 由 `lib/index.js` 读进 `ctx.skills.register` | 同一文件是两格式的**唯一内容源** |
| `mcp.json`（`stdio`/`streamable-http`/`sse`） | 通过 DSH 服务/事件提供能力 | MCP 是独立协议，DSH 侧不强制 |
| `resourceBase`（技能目录基准） | `ctx.skills.register({ resourceBase: { kind:'directory', path } })` | 相对引用解析一致 |
| agent 客户端（Codex/Cursor/…）加载 | `dsh plugin --profile <name> add <spec>` | 两套安装入口 |

## 6. ⚠️ 单目录双格式布局图

同一目录同时是 DSH 静态插件包 + Agent Plugins 1.0 包（照本技能自身结构）：

```
my-plugin/                          （= npm 包）
├── package.json      # type:module; main:lib/index.js;
│                     # "dsh":{"bundle":{"patch":"./cordis.patch.yml"}}
│                     # files:[lib,skills,cordis.patch.yml,plugin.json,README*,LICENSE]
├── plugin.json       # Agent Plugins 1.0 清单（$schema + name/version/description/…）
├── cordis.patch.yml  # - insert: - id: <name>-skill , name: '<package-name>'
├── lib/index.js      # Cordis 入口：inject:['skills']; apply() 读 skills/<name>/SKILL.md 注册进 ctx.skills
└── skills/<name>/    # ← Agent Plugins 技能，也即 DSH Agent 技能目录
    ├── SKILL.md      #   唯一内容源（frontmatter 必须含 name+description）
    ├── references/   #   分册参考（可选）
    └── scripts/      #   可执行脚本（可选）
```

对应关系要点（双格式不要分叉）：
- **`SKILL.md` 是唯一内容源**；`lib/index.js` 只做"把 SKILL.md 注册进 `ctx.skills`"，不复制内容，避免两处维护。
- `lib/index.js` 注册模板见 `SKILL.md` Step 3（`inject: ['skills']`，`resourceBase` 指向 `skills/<name>/`）。
- `cordis.patch.yml` 的 `name` 用**包名**（`name: '<package-name>'`）按 npm 解析已装代码。
- DSH profile bundle 经 `dsh plugin --profile <name> add <git-url|path|npm-name>` 安装；agent-plugins 客户端读 `plugin.json` + `skills/`。

## 7. 验证（两种格式都要过）

- DSH：`dsh plugin --profile <profile> add <spec>`；重启后技能出现在 agent 技能目录，无报错。
- Agent Plugins：检查 `plugin.json` 合规（`$schema`、name 规则）、`skills/<name>/SKILL.md` 存在且 frontmatter 完整；可选用支持 agent-plugins 的客户端（Codex/Cursor/VS Code 等）加载。
- 发布：`npm pack --dry-run` 确认 `files` 含 `lib/`、`skills/`、`cordis.patch.yml`、`plugin.json`。

## 8. 事实源与已知缺口

- ✅ plugin.json 字段与双格式布局：本技能 `plugin.json` / `package.json` / `SKILL.md`（已核实实例）。
- ⚠️ 规范更细（如 `mcp.json` 完整 schema、`author` 必选性、可加载清单字段）不在本分册给定事实源中——落地时以 `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` 与目标客户端文档为准。
