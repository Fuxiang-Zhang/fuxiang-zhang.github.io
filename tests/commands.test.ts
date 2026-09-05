import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCommands, parseInput } from '../src/commands.js';

test('slash commands browse the intended section, while prose remains a question', () => {
  const papers = parseInput('  /papers  ');
  assert.equal(papers.kind, 'command');
  if (papers.kind === 'command') assert.equal(papers.command.topic, 'publications');
  assert.deepEqual(parseInput(' Tell me about /papers '), { kind: 'question', text: 'Tell me about /papers' });
  assert.deepEqual(parseInput('你好，介绍一下你的研究'), { kind: 'question', text: '你好，介绍一下你的研究' });
  assert.deepEqual(parseInput(' \n '), { kind: 'empty' });
});

test('unknown commands and unsupported arguments never fall through to chat', () => {
  for (const input of ['/unknown', '/papers --year 2025', '/bio\nhello', '/pa', '/', '/BIO']) {
    assert.equal(parseInput(input).kind, 'invalid');
  }
});

test('completion narrows slash input without treating prose or arguments as commands', () => {
  assert.deepEqual(matchCommands('/pa').map(command => command.name), ['/papers']);
  assert.deepEqual(matchCommands('  /ex').map(command => command.name), ['/experience']);
  for (const input of ['hello', '/papers --year', '/bio\n', '/unknown']) assert.deepEqual(matchCommands(input), []);
  assert.ok(matchCommands('/').some(command => command.name === '/help'));
});
