#!/usr/bin/env node
/**
 * verify.mjs — dsh-dual-plugin-guide 双格式产物自检脚本。
 *
 * 吸收自社区 verify-kit 的校验思路，裁剪为不依赖官方 checkout 的三层：
 *   1. 关键路径存在清单（双格式产物）
 *   2. 身份一致性：plugin.json.name == package.json.name；SKILL.md frontmatter 断言
 *   3. Markdown 相对链接可解析（跳过 http/绝对/锚点）
 *
 * 用法：node scripts/verify.mjs [包根目录]     （默认 = 本文件上一级）
 * 退出码：0 通过，非 0 有失败项。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(
  process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
);
const failures = [];
const ok = (msg) => console.log('  \u2713 ' + msg);
const fail = (msg) => { failures.push(msg); console.error('  \u2717 ' + msg); };

let pkg, plg, name;
try {
  pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  plg = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  name = pkg.name;
} catch (error) {
  console.error(`error: cannot read package.json/plugin.json at ${root}: ${error.message}`);
  process.exit(1);
}
console.log(`校验包：${name} @ ${root}`);

// ---- 1. 关键路径 ----
console.log('[1/3] 关键路径（双格式契约五件套）');
const critical = [
  'package.json', 'plugin.json', 'cordis.patch.yml', 'lib/index.js',
  join('skills', name, 'SKILL.md'),
];
for (const f of critical) {
  existsSync(join(root, f)) ? ok(f) : fail(`missing: ${f}`);
}
// 可选件：存在即校验，缺失不失败（最小技能合法）
const optional = [
  join('skills', name, 'scripts', 'scaffold.mjs'),
  join('skills', name, 'scripts', 'verify.mjs'),
];
for (const f of optional) {
  existsSync(join(root, f)) ? ok(`${f} (optional)`) : ok(`${f} (optional, absent — fine)`);
}
const refDir = join(root, 'skills', name, 'references');
if (existsSync(refDir)) {
  const refs = readdirSync(refDir).filter((x) => x.endsWith('.md')).sort();
  if (refs.length === 0) fail('references/ is empty');
  for (const f of refs) ok(`references/${f}`);
} else {
  ok('references/ (optional, absent — minimal skill is valid)');
}

// ---- 2. 身份一致性与 frontmatter ----
console.log('[2/3] 身份一致性与 frontmatter');
if (plg.name === pkg.name) ok(`plugin.json.name == package.json.name ("${name}")`);
else fail(`plugin.json.name ("${plg.name}") != package.json.name ("${pkg.name}")`);
const skillPath = join(root, 'skills', name, 'SKILL.md');
if (existsSync(skillPath)) {
  const skill = readFileSync(skillPath, 'utf8');
  const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    /^name:/m.test(fm[1]) ? ok('SKILL.md frontmatter has name') : fail('SKILL.md frontmatter missing name');
    /^description:/m.test(fm[1]) ? ok('SKILL.md frontmatter has description') : fail('SKILL.md frontmatter missing description');
  } else {
    fail('SKILL.md missing YAML frontmatter');
  }
} else {
  fail(`skills/${name}/SKILL.md not found`);
}
if (pkg.dsh?.bundle?.patch) ok(`dsh.bundle.patch = ${pkg.dsh.bundle.patch}`);
else fail('package.json missing dsh.bundle.patch');

// ---- 3. 相对链接解析 ----
console.log('[3/3] Markdown 相对链接');
const mdFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.md')) mdFiles.push(p);
  }
})(root);
let links = 0;
for (const f of mdFiles) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|#|\/)/.test(target)) continue; // 外链 / 锚点 / 绝对路径
    links++;
    const resolved = resolve(dirname(f), target.split('#')[0]);
    if (!existsSync(resolved)) fail(`${relative(root, f)}: broken link -> ${target}`);
  }
}
ok(`${links} 个相对链接已检查`);

if (failures.length === 0) {
  console.log(`\n\u2705 verify 通过（${critical.length} 关键文件 + ${links} 链接）`);
  process.exit(0);
} else {
  console.error(`\n\u274c ${failures.length} 个问题`);
  process.exit(1);
}
