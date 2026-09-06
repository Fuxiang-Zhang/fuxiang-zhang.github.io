import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommands, matchCommands, parseInput } from '../src/commands.js';
import { commandOf, sectionId } from '../src/types.js';
import { site } from './helpers.js';

/** The command list is the file's own, so the tests drive it from data/site.md. */
const commands = buildCommands(site);

test('slash commands browse the intended section, while prose remains a question', () => {
  const papers = parseInput('  /papers  ', commands);
  assert.equal(papers.kind, 'command');
  if (papers.kind === 'command') assert.equal(papers.command.topic, 'papers');
  assert.deepEqual(parseInput(' Tell me about /papers ', commands), { kind: 'question', text: 'Tell me about /papers' });
  assert.deepEqual(parseInput('你好，介绍一下你的研究', commands), { kind: 'question', text: '你好，介绍一下你的研究' });
  assert.deepEqual(parseInput(' \n ', commands), { kind: 'empty' });
});

test('unknown commands and unsupported arguments never fall through to chat', () => {
  for (const input of ['/unknown', '/papers --year 2025', '/bio\nhello', '/pa', '/', '/BIO']) {
    assert.equal(parseInput(input, commands).kind, 'invalid');
  }
});

test('the command list is exactly what data/site.md declares, in file order', () => {
  const declared = site.sections.flatMap(section => commandOf(section) ? [[commandOf(section), section.fields.summary]] : []);
  assert.deepEqual(commands.filter(command => command.topic).map(command => [command.name, command.description]), declared);
  assert.deepEqual(commands.at(-1)?.name, '/help', 'the page provides /help itself, after the file\'s own commands');
  // Each command names the section it prints, and every session-bearing section has one.
  for (const command of commands) {
    if (!command.topic) continue;
    assert.ok(site.sections.some(section => sectionId(section) === command.topic && commandOf(section) === command.name));
  }
});

test('completion narrows slash input without treating prose or arguments as commands', () => {
  assert.deepEqual(matchCommands('/pa', commands).map(command => command.name), ['/papers']);
  assert.deepEqual(matchCommands('  /ed', commands).map(command => command.name), ['/education']);
  assert.deepEqual(matchCommands('/w', commands).map(command => command.name), ['/work']);
  for (const input of ['hello', '/papers --year', '/bio\n', '/unknown']) assert.deepEqual(matchCommands(input, commands), []);
  assert.ok(matchCommands('/', commands).some(command => command.name === '/help'));
});

test('legacy publication hashes, actual ids, paper details and skip links resolve consistently', async () => {
  const { resolveRoute } = await import('../src/commands.js');
  for (const hash of ['#papers', '#publication', '#publications']) {
    assert.deepEqual(resolveRoute(hash, site), { kind: 'preset', topic: 'papers' });
  }
  assert.equal(resolveRoute('#main', site), null);
  assert.deepEqual(resolveRoute('#help', site), { kind: 'help' });
  assert.deepEqual(resolveRoute('#paper/rear', site), { kind: 'paper', paperId: 'rear' });
  const changed = { ...site, sections: site.sections.map(section => section.fields.command === '/papers'
    ? { ...section, fields: { ...section.fields, id: 'library' } } : section) };
  assert.deepEqual(resolveRoute('#publications', changed), { kind: 'preset', topic: 'library' });
  const actual = { ...site, sections: [...site.sections, { title: 'Actual', fields: { command: '/publication' }, prose: [], children: [] }] };
  assert.deepEqual(resolveRoute('#publication', actual), { kind: 'preset', topic: 'publication' });
});
