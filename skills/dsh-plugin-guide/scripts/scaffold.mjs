#!/usr/bin/env node
/**
 * dsh-plugin-guide scaffold generator.
 *
 * Generates a valid dual-format plugin skeleton (DSH static plugin package +
 * Agent Plugins 1.0) into a target directory:
 *
 *   node scripts/scaffold.mjs <plugin-name> [target-dir]
 *
 * The generated skeleton is directly installable:
 *   - DSH:           dsh plugin --profile <profile> add <target-dir|git-url>
 *   - Agent Plugins: point a compatible client at the directory, or publish it
 *   - Standard skills: npx skills add <target-dir>
 *
 * No dependencies — plain Node ESM.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function fail(message) {
  console.error(`error: ${message}`);
  console.error('usage: node scripts/scaffold.mjs <plugin-name> [target-dir]');
  process.exit(1);
}

const name = process.argv[2];
if (!name) fail('missing plugin name');
if (!NAME_PATTERN.test(name)) {
  fail(
    `"${name}" is not a valid plugin name — lowercase letters, digits, dots and single hyphens only; no leading/trailing "-", no "--" or ".."`,
  );
}

const target = resolve(process.argv[3] ?? join(process.cwd(), name));

/** Templates use __NAME__ as the package/plugin name placeholder. */
const files = {
  'package.json': `{
  "name": "__NAME__",
  "version": "0.1.0",
  "description": "Dual-format plugin: DSH static plugin package (dsh plugin --profile add) + Agent Plugins 1.0 (plugin.json + skills/).",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  "files": [
    "lib",
    "skills",
    "cordis.patch.yml",
    "plugin.json",
    "README.md",
    "LICENSE"
  ],
  "license": "MIT",
  "keywords": [
    "deepseek",
    "dsh",
    "dsh-plugin",
    "agent-plugins",
    "dual-format",
    "skill"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
`,
  'plugin.json': `{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "__NAME__",
  "version": "0.1.0",
  "description": "Dual-format plugin: DSH static plugin package + Agent Plugins 1.0.",
  "license": "MIT",
  "keywords": [
    "deepseek",
    "dsh",
    "dsh-plugin",
    "agent-plugins",
    "dual-format",
    "skill"
  ]
}
`,
  'cordis.patch.yml': `# __NAME__ dsh bundle patch: register the skill at runtime.
# Installed with: dsh plugin --profile <name> add <spec> (spec = git URL, path, or npm name)
- insert:
    - id: __NAME__-skill
      name: '__NAME__'
`,
  'lib/index.js': `/**
 * __NAME__ dsh bundle entry — reads skills/__NAME__/SKILL.md and registers it
 * with ctx.skills so the skill appears in the agent's catalog.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = '__NAME__-skill';
export const inject = ['skills'];

const SKILL_DIR = new URL('../skills/__NAME__/', import.meta.url);
const SKILL_FILE = new URL('SKILL.md', SKILL_DIR);

/** Minimal YAML-frontmatter parser for name/description/whenToUse. */
function parseFrontmatter(text) {
  const match = text.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n?/);
  if (!match) return null;
  const fm = match[1];
  const get = (key) => {
    const line = fm.match(new RegExp('^' + key + ':\\\\s*(.+)$', 'm'));
    if (!line) return undefined;
    let value = line[1].trim();
    const quoted = (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    return value;
  };
  return {
    name: get('name'),
    description: get('description'),
    whenToUse: get('whenToUse'),
  };
}

export function apply(ctx) {
  let raw;
  try {
    raw = readFileSync(SKILL_FILE, 'utf-8');
  } catch (error) {
    ctx.logger.error('__NAME__: cannot read SKILL.md: %s', error.message);
    return;
  }
  const meta = parseFrontmatter(raw);
  if (!meta || !meta.name || !meta.description) {
    ctx.logger.error(
      '__NAME__: SKILL.md frontmatter missing name/description; skill not registered',
    );
    return;
  }
  const content = raw.replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n?/, '').trimStart();
  const disposer = ctx.skills.register({
    name: meta.name,
    description: meta.description,
    ...(meta.whenToUse ? { whenToUse: meta.whenToUse } : {}),
    content,
    source: 'runtime',
    resourceBase: {
      kind: 'directory',
      path: fileURLToPath(SKILL_DIR),
    },
  });
  ctx.logger.info('__NAME__: registered skill "%s"', meta.name);
  ctx.on('dispose', () => {
    if (typeof disposer === 'function') disposer();
  });
}
`,
  'skills/__NAME__/SKILL.md': `---
name: __NAME__
description: TODO — describe what this skill does and when to use it. Keep it pushy: name concrete trigger contexts.
---

# __NAME__

TODO — write the instructions here. Add optional references/ and scripts/ siblings
for progressive disclosure; the dsh bundle entry (lib/index.js) registers this file
into ctx.skills, and Agent Plugins clients discover it from skills/__NAME__/SKILL.md.
`,
  'README.md': `# __NAME__

Dual-format plugin: installs as a DSH static plugin package **and** as an
Agent Plugins 1.0 plugin.

## Install

- DSH: \`dsh plugin --profile <profile> add <git-url|path|npm-name>\`
- Agent Plugins 1.0: point a compatible client at this directory, or publish it
- Standard skills: \`npx skills add <path|git-url>\`

## Structure

\`\`\`
__NAME__/
├── package.json      # dsh.bundle.patch → cordis.patch.yml
├── plugin.json       # Agent Plugins 1.0 manifest
├── cordis.patch.yml  # dsh bundle insert
├── lib/index.js      # Cordis entry: registers skills/__NAME__/SKILL.md into ctx.skills
└── skills/__NAME__/  # SKILL.md + optional references/ + scripts/
\`\`\`
`,
  'LICENSE': `MIT License

Copyright (c) 2026 __NAME__ contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
};

for (const [rel, content] of Object.entries(files)) {
  const out = join(target, rel.replaceAll('__NAME__', name));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content.replaceAll('__NAME__', name), 'utf-8');
}

console.log(`scaffolded dual-format plugin "${name}" at ${target}`);
console.log('');
console.log('next steps:');
console.log(`  1. edit skills/${name}/SKILL.md — the single source of content`);
console.log('  2. DSH install:      dsh plugin --profile <profile> add ' + target);
console.log(`  3. Agent Plugins:    point a compatible client at ${target}`);
console.log('  4. Standard skills:  npx skills add ' + target);
