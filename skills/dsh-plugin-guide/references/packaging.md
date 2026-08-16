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
