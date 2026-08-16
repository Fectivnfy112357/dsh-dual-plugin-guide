# DSH 静态插件打包全流程（packaging.md）

> 提炼自 static-plugin-reference.md（来源：DSH 官方英文文档 `docs/user/develop/basic/{tool,config,publish}.md`、
> `framework/index.md`、`docs/cookbook/{adding-a-package,adding-a-tool}.md`）。

## 1. 概念：bundle 与 profile

- **bundle**：npm 包配送的一个配置层，manifest 声明 `dsh.bundle`（"贡献什么"）。bundle 是你**分发**的。
- **profile**：`$DSH_HOME/profiles/<name>` 目录，`dsh.profile`（"用哪些 bundle、什么顺序"）。profile 是 `dsh --profile <name>` 启动的。
- 二者互不为对方。`--patch <file>` 指本地覆盖层。

## 2. 包布局

```
hello-plugin/
├── package.json       # 声明 dsh.bundle
├── cordis.patch.yml   # profile 列出该 bundle 时应用的 layer
└── index.js           # patch 行引用的插件模块
```

`package.json`（要点）：
```json
{
  "name": "dsh-hello-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```
`index.js`：`export const name = 'hello-plugin'`；`export function apply() { … }`。
`cordis.patch.yml`（同 `--patch` 覆盖层 YAML，**按包名引用**让 Node 解析已装代码）：
```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```
> 无 `dsh.bundle` 的包也能装，但只是普通依赖，`dsh plugin` 警告且不激活 layer。

## 3. 安装命令

```sh
dsh plugin --profile demo add ./hello-plugin   # 首次自动初始化 profile（@deepseek-ai/dsh-base 首 bundle）、pnpm link、追加进 bundles
dsh --profile demo --dump-config      # 验层，显示 "# == dsh-hello-plugin"
dsh --profile demo
dsh plugin --profile demo remove dsh-hello-plugin   # 同时移依赖和 layer
```

## 4. 四层加载顺序（后续层按行胜出）

1. profile `dsh.profile.bundles` 各 bundle patch（`@deepseek-ai/dsh-base` 最先）
2. profile 自己 `cordis.patch.yml`
3. `$DSH_HOME/cordis.patch.yml`
4. 每个 `--patch <path>`（argv 顺序）

要点：
- patch **整体替换**行内 `config`，不深合并；覆盖早前 layer 行要重述所需每个 key。
- 用户可在自己 patch 覆盖你的行，故默认值应为用户大概率保留，其余交 schema。
- 盒内 bundle 名从 DSH 安装自身解析，可放心依赖 `@deepseek-ai/dsh-base`。

## 5. config schema 声明

```js
import Schema from '@deepseek-ai/schemastery'
export const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
  verbose: Schema.boolean().default(false),
})
```
`cordis.yml` 插件行配置：`config: { greeting: 'Hi there', … }`。**不要**用普通对象导出 `Config`——须用 `@deepseek-ai/schemastery`（Standard Schema 接口）。
设计原则：凡两部署可能设成不同的值都做成配置字段（判据：`cordis.yml` 不改代码即可改值）；非法配置 fail loudly。

## 6. 安装来源的坑

- **Git 安装**拉源码而非构建产物，不跑 `build`，TS 包缺 `lib/` 无法加载。
  - **作者**：提供 `prepare` 脚本（pnpm git 安装后运行），自包含从源码构建，勿假设 dev 环境。参考 [turtle-ui](https://github.com/deepseek-harness/turtle-ui)。
  - **用户**：pnpm≥10 拒绝经 git 依赖跑 `prepare` 直到放行；首次 `add` 失败，DSH 提示把包 key 拷进 profile 的 `pnpm-workspace.yaml` 再重跑：
    ```yaml
    allowBuilds:
      dsh-hello-plugin: true
    ```
    这是**授权在安装时执行该包代码**，只放行信任源码并钉 commit（`#<sha>`）。
- **npm / tarball**：免放行则分发构建产物——`pnpm publish` 到 npm（`dsh plugin add your-package`），或 `pnpm pack` 出 tarball（`dsh plugin add ./hello-plugin-0.1.0.tgz`）。
- 安装源：`dsh plugin --profile demo add github:you/hello-plugin`（git）、`add <path>`（本地）、`add <npm-name>`、`add <spec.tgz>`。

## 7. 生命周期与清理（打包时注意）

- 经 `ctx` 的注册卸载自动撤销：`ctx.on`、`ctx.tools.register`、`ctx.llm.registerAdapter`、`ctx.effect(() => cleanup)`。
- `ctx.plugin(childPlugin)` 建子 Fiber：继承父 context、独立生命周期、随父卸载。
- 手动停：`const fiber = ctx.plugin(myPlugin); await fiber.dispose()`。`dispose` 保证：①移除全部注册 ②递归卸载子插件 ③promise 在所有异步清理后 resolve。
- HMR：加载 `@deepseek-ai/cordis-plugin-hmr` 后，编辑源码触发：卸载旧插件清注册 → 加载新代码 → 跑新 `apply`。

## 8. 身份与依赖的坑（独立包必踩）

- **cordis 双副本 / 双 Cordis 分裂**：构建期若从 `.pnpm` 副本解析 cordis，与 harness 的 vendored 副本是两个模块 → `declare module '@deepseek-ai/cordis'` 类型增强合并不了 → `Property 'tools' does not exist on type 'Context'`。**scoped `@deepseek-ai/cordis` 与 unscoped `cordis` 混用同样分裂**（dsh-tools 的类型只增强 scoped 版本）。独立包把 cordis 设为 `peerDependencies`（+ dev），版本对齐宿主。
- **npm `latest` 标签可能是过期版本**：`@deepseek-ai/dsh-tools` 与 `@deepseek-ai/dsh-session-persistence-jsonl` 的 `latest` 停在 `0.0.1-rc.1`，`next` 才是 `0.1.0-rc.6`（2026-08-14 复核）；`create-dsh-plugin` latest=0.1.1；`dsh-core`/`dsh-sdk` 仍未发布（404）。裸 `npm i @deepseek-ai/dsh-tools` 会踩旧版——脚手架/脚本显式钉 `next` 标签版本。
- **无作用域 `dsh` 是无关项目 node-dsh**（"A shell written in JavaScript"）——官方 CLI 包是 `@deepseek-ai/dsh`，别装错。
- **官方 `@deepseek-ai/*` 早期未发布 npm**（rc 早期社区 bundle 靠 profile pnpm 闭包 flat fallback 注入，声明依赖反而解析失败）；rc.6 起公开。旧资料的两条时间线都要知道，按当时宿主版本取舍。

## 9. TS 构建四坑（TS 插件包）

- tsconfig 实测可用组合：`module: esnext` + `moduleResolution: bundler` + `allowImportingTsExtensions: true`（否则 TS5097）+ `rewriteRelativeImportExtensions: true`（否则产物残留 `./x.ts` 导入 → 运行时 ESM 崩溃）+ `lib: ["ES2024"]` + `outDir: lib` + `declarationDir: lib/types`；用 `Buffer`/`node:` 时显式 `"types": ["node"]`。
- **`tsc` 报错仍会 emit 产物**（`noEmitOnError` 默认 false）——构建脚本必须 `tsc ... || exit 1` 或加 `--noEmitOnError`；发布前 `grep -rE "from './[^']+\.ts'" lib/` 验证无 `.ts` 残留。
- `main`/`types` 声明 `lib/...` 但 tsconfig 无 `outDir` → 产物落到 src 旁，运行时找不到入口。
- git 安装跑 `prepare` 要**自包含**：不假设 monorepo 兄弟目录、不跑类型检查，用专用 tsdown 配置转译 `src/`；`pnpm pack --dry-run --json` 检查最终文件清单。

## 10. Windows 实测坑

- **junction**：`ln -s` 与 `cmd mklink /J`（MSYS 参数转换）都失败，**PowerShell `New-Item -ItemType Junction` 稳定可用**；`@types` 不能整体 junction（内部是 pnpm 符号链接，tsc 无法穿透），要直达 `.pnpm/@types+node@<ver>/node_modules/@types/node` 真实路径。
- `path.resolve()` 返回反斜杠，与正斜杠路径比较恒 false（路径逃逸误报）；比较前两侧都 `resolve()` 或统一分隔符。
- vitest：盘符必须大写（`C:/`，小写 `c:/` 报 "no tests"）；`| tail` 会截掉汇总行，用 `grep -E 'Test Files|Tests '` 取结果。
- `DSH_PERMISSION_MODE=danger-full-access` 是**高风险模式**（Windows 无沙箱后端时仅此可启动，且禁用审批提示）——只用于可信本地开发机，不要写进模板/CI/共享机器。
- `DSH_*` 特殊环境变量必须由启动环境传入，放 `~/.dsh/.env` 会启动报错；凭据在 `$DSH_HOME/.credentials.yaml`。

## 11. 机制漂移警示（照旧文档会踩）

- **repository-plugin（`.dsh-plugin` 目录）0809 推出、0811 已从仓库移除**：官方文档残留 "repository plugins land in global layer" 等旧表述会误导。当前只有 **bundle**（`dsh.bundle.patch`）与**纯 cordis** 两条安装通道——以当前宿主运行时为准。
- 服务批量改名（如 `httpServer→webServer`、`tasks→jobs`、`bash→shell`）：写插件前用运行时 `cordis_inspect_*` / services.md 核对当前名，不要照旧文档。
