---
name: dsh-plugin-guide
description: 构建/修改/调试 DSH（DeepSeek Harness / Cordis）插件的完整开发指导，并产出 Agent Plugins 1.0 双格式插件（plugin.json + skills/），可经 dsh plugin --profile add 安装。覆盖动态 Cordis 插件、静态插件包、事件与 hook、Slots、Services、动态 Tool、打包发布、双格式布局与验证。当用户提到 dsh 插件、deepseek-harness 插件、cordis 插件、agent plugin、plugin.json、双格式/dual-format 插件、dsh plugin --profile add、技能打包分发时使用本技能，即使他们没有明确说出"插件"或"指导"。
whenToUse: 用户请求创建/修改/调试 DSH 插件，或需要产出可同时通过 DSH（dsh plugin --profile add）与 Agent Plugins 1.0 生态安装的插件包。
---

# dsh-plugin-guide — 双格式插件开发指导

本技能指导 agent 构建 DSH（DeepSeek Harness，Cordis 内核）插件，并默认产出**双格式**结果：同一个目录既是 DSH 静态插件包，也是 Agent Plugins 1.0 包。本技能自身就是这种双格式结构（`package.json` + `plugin.json` + `cordis.patch.yml` + `lib/index.js` + `skills/dsh-plugin-guide/`），安装方式见 README。

## 核心原则

1. **事实库先行，绝不猜 API**。事件名、服务名、Slot 名、Builtin 都有精确清单，放在 `references/`。写代码前先查对应分册；如果运行环境提供 `cordis_inspect_list` / `cordis_inspect_query` 工具，先 list 再 query 确认签名。凭空编造的事件名/服务名是 DSH 插件失败的第一大原因。
2. **就近最小侵入**。能注册一个 Slot 组件就别替换整个产品 UI；能 `ctx.get` 可选依赖就别声明 `inject` 硬依赖；只取需要的叶子字段，不复制整个 Session/Tool 对象。
3. **副作用必须可清理**。所有经 `ctx` 注册的东西（事件监听、工具、服务、Slot、定时器、effect）在插件卸载时自动清理；外部资源用 `ctx.effect(() => disposer)` 显式归还。不要在模块顶层或 `apply()` 外做进程级副作用。
4. **双格式默认**。用户要"DSH 插件"时，默认按本技能的双格式流程产出；只有明确只要一种格式时才收窄。

## 先选目标形态

| 用户需求 | 形态 | 做法 |
|---|---|---|
| 临时工具/UI 增强，立即看效果 | 动态 Cordis 插件 | 用 `cordis_*` 工具：inspect → define → run（临时、进程内、重启即失，不用打包） |
| 持久安装、可分发、要发布 | 静态插件包 | 本技能主流程：写代码 → 打包 → `dsh plugin --profile add` |
| 跨生态分发（DSH + Codex/Cursor/VS Code 等） | **双格式**（默认） | 本技能完整流程：单目录同时含 DSH 结构与 Agent Plugins 1.0 结构 |
| 只是给某个 agent 会话配技能组合 | Agent preset | 属组合层，不在本技能范围；见 DSH 自带 editing-cordis-compositions |

## 工作流

### Step 0：读事实库索引

打开 `references/README.md` 确定要查哪些分册。至少读：`core-api.md`（核心 API 与纠偏）、`events-hooks.md`（事件名）、`packaging.md`（打包）与 `agent-plugins-1.0.md`（双格式）。

### Step 1：写核心逻辑（Cordis 插件）

三种形态（函数形足够多数场景）：

```js
// 函数形
export const name = 'my-plugin'
export const inject = ['tools']          // 硬依赖；可选依赖用 ctx.get
export function apply(ctx) {
  ctx.on('some/event', (payload) => { /* ... */ })
}
```

关键规则（完整清单见 references/core-api.md）：

- `apply(ctx)` 内注册一切；事件监听用 `ctx.on`，卸载自动清理
- 依赖：硬依赖 `inject: ['x']`（未就绪不加载）；可选依赖 `ctx.get('x')` + undefined 检查
- 事件四种 mode：`emit`（广播）/ `bail`（短路）/ `serial`（顺序短路）/ `waterfall`（管道，**必须调 `next()`** 否则短路下游）——mode 和签名查 `references/events-hooks.md`
- `harness` 是 **Host 沙箱全局对象**（`harness.handle` / `harness.defineTool` / `harness.registerTool`），**不是服务**，不能 `ctx.get('harness')`；Client 侧调用 Host 用 `host.call`
- Client UI 必须用 `React.createElement`，不能用 JSX；注册进查过的 Slot（`slots.inject` + `slots.register`），Slot 清单见 `references/slots.md`
- 动态 Tool：`harness.registerTool(ctx, harness.defineTool({...}))`，注册属于当前 Fiber，stop/update 自动移除；`execute` 只返回规范值，参数/返回值必须 JSON 兼容（lossless）

### Step 2：按双格式打包

单目录布局（照本技能自身结构）：

```
my-plugin/
├── package.json      # name/type:module/main:lib/index.js + "dsh":{"bundle":{"patch":"./cordis.patch.yml"}} + files:[lib,skills,...]
├── plugin.json       # Agent Plugins 1.0 清单（$schema: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json）
├── cordis.patch.yml  # - insert: - id: <id>-skill, name: '<package-name>'
├── lib/index.js      # Cordis 入口：inject:['skills']，apply() 读 skills/<name>/SKILL.md 注册进 ctx.skills
└── skills/<name>/
    ├── SKILL.md      # ← 唯一内容源（Agent Skills 格式，frontmatter 需 name+description）
    ├── references/   # 分册参考（可选）
    └── scripts/      # 可执行脚本（可选）
```

步骤：

1. 先写 `skills/<name>/SKILL.md`（内容主体，frontmatter 必须含 `name` 和 `description`）
2. 写 `lib/index.js`（注册器，见 Step 3 模板）；`package.json` 声明 `dsh.bundle.patch` 并保证 `files` 包含 `lib`、`skills`、`cordis.patch.yml`、`plugin.json`
3. 写 `plugin.json`（name 规则：小写字母数字 `-`/`.`，不能 `--`/`..`；`$schema` 指向 agent-plugins.org 1.0.0）
4. 如技能需要 MCP 服务器，在包根放 `mcp.json`（每个 server 显式声明 type：`stdio`/`streamable-http`/`sse`）；不需要就不放
5. 双格式的"两份"内容不要分叉：`lib/index.js` 只负责把 `skills/<name>/SKILL.md` 注册进 `ctx.skills`，SKILL.md 是唯一内容源，避免两处维护

可以直接跑本包自带的脚手架生成器生成合法骨架：

```bash
node scripts/scaffold.mjs my-plugin [target-dir]
```

### Step 3：lib/index.js 注册器模板

```js
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const name = '<name>-skill'
export const inject = ['skills']

const SKILL_DIR = new URL('../skills/<name>/', import.meta.url)
const SKILL_FILE = new URL('SKILL.md', SKILL_DIR)

export function apply(ctx) {
  const raw = readFileSync(SKILL_FILE, 'utf-8')
  // 解析 frontmatter 的 name/description/whenToUse，正文为 content
  const disposer = ctx.skills.register({
    name: meta.name,
    description: meta.description,
    whenToUse: meta.whenToUse,
    content,
    source: 'runtime',
    resourceBase: { kind: 'directory', path: fileURLToPath(SKILL_DIR) },
  })
  ctx.on('dispose', () => disposer?.())
}
```

### Step 4：验证

安装验证（两种格式都要过）：

```bash
# DSH 侧：装进 profile，确认无报错（重启后技能应出现在 agent 技能目录）
dsh plugin --profile <profile> add <git-url|path|npm-name>

# Agent Plugins 侧：确认 plugin.json 合规（$schema、name 规则）、skills/<name>/SKILL.md 存在且 frontmatter 完整
# 可选：用支持 agent-plugins 的客户端（Codex/Cursor/VS Code 等）加载验证
```

额外检查：

- `npm pack --dry-run` 确认发布内容包含 `lib/`、`skills/`、`cordis.patch.yml`、`plugin.json`
- `plugin.json` 的 name 与 npm 包名一致或至少不冲突
- 技能正文里的相对引用（references/、scripts/）能经 resourceBase 解析

## 常见错误与排查

| 症状 | 先查 |
|---|---|
| `service "x" is not declared` | 用了 `ctx.x` 但没声明 `inject: ['x']`；改用 `ctx.get('x')` + 判空 |
| 事件不触发 / 下游被截断 | 事件名拼写（对照 references/events-hooks.md）；waterfall listener 是否漏调 `next()` |
| `harness is not a service` | 把 harness 当服务 `ctx.get('harness')` 了；它是 Host 沙箱全局对象 |
| Client 解析失败 | 用了 JSX/TS/import/未确认的全局；改用 `React.createElement` |
| Slot 注册失败 | Slot 名/协议（single/list/keyed/chain）没查 references/slots.md |
| 技能没出现在目录 | lib/index.js 的 inject 缺 `skills`、SKILL.md frontmatter 缺 name/description、cordis.patch.yml 的 name 与包名不符 |
| Agent Plugins 客户端不认 | plugin.json name 含 `--`/`..` 或大写；skills/ 子目录没有 SKILL.md |

## references/ 目录

| 文件 | 内容 | 何时读 |
|---|---|---|
| `references/README.md` | 分册索引 | 每次开始前 |
| `references/core-api.md` | Cordis 核心 API、三种形态、Fiber 状态机、Builtin、harness 纠偏 | 写任何代码前 |
| `references/events-hooks.md` | 81 个事件全量目录（名+mode+签名）、生命周期钩子 | 用事件前必读 |
| `references/services.md` | 55 Host + 7 Client 服务清单与用法 | 用服务前必读 |
| `references/slots.md` | 42 个 Client Slot 清单与注册模式 | 写 UI 前必读 |
| `references/tools.md` | 动态 Tool 注册、现有工具名清单、execute 契约 | 注册工具前必读 |
| `references/packaging.md` | DSH 静态插件打包全流程（bundle/patch/安装/发布坑） | Step 2 前必读 |
| `references/agent-plugins-1.0.md` | Agent Plugins 1.0 规范与双格式对应 | Step 2 前必读 |

所有分册内容来自已核实的运行时清单与官方文档交叉核对；发现矛盾以真实运行时代码为准（分册内会标注"纠偏"）。
