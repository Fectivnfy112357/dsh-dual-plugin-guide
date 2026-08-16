# dsh-dual-plugin-guide

**Dual-format plugin development guide.** This plugin teaches an agent how to
build plugins that are compatible with **both** ecosystems from one directory:

- **DSH static plugin package** — installable via `dsh plugin --profile <name> add <spec>`
- **Agent Plugins 1.0** — `plugin.json` + `skills/`, loadable by compatible clients (Codex, Cursor, VS Code, …)
- (bonus) **Standard agent skills** — `npx skills add` discovers the same `skills/` tree

Not DSH-only: this package itself installs through both formats.

## Install

```bash
# DSH — register the guidance skill into the agent catalog
dsh plugin --profile web add github:Fectivnfy112357/dsh-dual-plugin-guide

# Agent Plugins 1.0 — point a compatible client at the repo, or publish it
#   https://github.com/Fectivnfy112357/dsh-dual-plugin-guide
# Standard skills
npx skills add Fectivnfy112357/dsh-dual-plugin-guide
```

After the DSH install and a profile restart, the `dsh-dual-plugin-guide` skill shows
up in the agent's skill catalog; the agent then follows it to build dual-format
plugins. The bundled `skills/dsh-dual-plugin-guide/scripts/scaffold.mjs` generates a
valid dual-format skeleton in one command.

## Structure

```
dsh-dual-plugin-guide/
├── package.json       # "dsh": {"bundle": {"patch": "./cordis.patch.yml"}}
├── plugin.json        # Agent Plugins 1.0 manifest
├── cordis.patch.yml   # dsh bundle insert (id: dsh-dual-plugin-guide-skill)
├── lib/index.js       # Cordis entry: registers skills/dsh-dual-plugin-guide/SKILL.md into ctx.skills
└── skills/dsh-dual-plugin-guide/
    ├── SKILL.md       # the guidance (single source of content)
    ├── references/    # verified fact catalog (events, services, slots, tools, packaging, agent-plugins)
    └── scripts/       # scaffold.mjs — dual-format skeleton generator
```

## How it works

`lib/index.js` is a minimal Cordis plugin (`inject: ['skills']`) that reads
`skills/dsh-dual-plugin-guide/SKILL.md` (Agent Skills format) and registers it with
`ctx.skills` via `resourceBase`, so relative references resolve. The same
`skills/` tree is what Agent Plugins clients and `npx skills` read — one
content source, three loaders.

## License

MIT
