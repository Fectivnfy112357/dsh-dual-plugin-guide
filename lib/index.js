/**
 * dsh-plugin-guide dsh bundle entry.
 *
 * A small Cordis plugin that reads this package's skill (Agent Plugins
 * layout: skills/dsh-plugin-guide/SKILL.md) and registers it with ctx.skills,
 * so the skill shows up in the agent's catalog when the package is installed
 * as a dsh profile bundle:
 *
 *   dsh plugin --profile web add <git-url-or-path>
 *
 * The skill body's relative references (references/, scripts/) resolve
 * against the skill directory (skills/dsh-plugin-guide/) via resourceBase.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-plugin-guide-skill';
export const inject = ['skills'];

/** Skill directory (Agent Plugins layout: skills/<name>/). */
const SKILL_DIR = new URL('../skills/dsh-plugin-guide/', import.meta.url);
const SKILL_FILE = new URL('SKILL.md', SKILL_DIR);

/** Minimal YAML-frontmatter parser for name/description/whenToUse. */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fm = match[1];
  const get = (key) => {
    const line = fm.match(new RegExp('^' + key + ':\s*(.+)$', 'm'));
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
    ctx.logger.error('dsh-plugin-guide: cannot read SKILL.md: %s', error.message);
    return;
  }
  const meta = parseFrontmatter(raw);
  if (!meta || !meta.name || !meta.description) {
    ctx.logger.error(
      'dsh-plugin-guide: SKILL.md frontmatter missing name/description; skill not registered',
    );
    return;
  }
  const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
  const skill = {
    name: meta.name,
    description: meta.description,
    ...(meta.whenToUse ? { whenToUse: meta.whenToUse } : {}),
    content,
    source: 'runtime',
    resourceBase: {
      kind: 'directory',
      path: fileURLToPath(SKILL_DIR),
    },
  };
  const disposer = ctx.skills.register(skill);
  ctx.logger.info('dsh-plugin-guide: registered skill "%s"', skill.name);
  ctx.on('dispose', () => {
    if (typeof disposer === 'function') disposer();
  });
}
