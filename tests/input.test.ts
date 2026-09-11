import test from 'node:test';
import assert from 'node:assert/strict';
import { typingAction, type TypingKey } from '../src/input.js';

const key = (key: string, patch: Partial<TypingKey> = {}): TypingKey => ({
  key, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...patch,
});

test('typing away from the composer accepts slash commands and Unicode text', () => {
  for (const value of ['/', 'a', 'A', ' ', '中', '🙂']) assert.equal(typingAction(key(value)), 'insert');
  assert.equal(typingAction(key('/'), true), 'insert');
});

test('global typing preserves browser shortcuts and keyboard control activation', () => {
  for (const value of ['Tab', 'Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'PageDown', 'Backspace']) {
    assert.equal(typingAction(key(value)), null);
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    for (const value of ['a', 'c', 'v', 'f', 'l', '/']) assert.equal(typingAction(key(value, { [modifier]: true })), null);
  }
  assert.equal(typingAction(key(' '), true), null);
});

test('IME and accent composition focus the input without inserting synthetic text', () => {
  assert.equal(typingAction(key('Process')), 'focus');
  assert.equal(typingAction(key('Dead')), 'focus');
  assert.equal(typingAction(key('Unidentified', { keyCode: 229 })), 'focus');
  assert.equal(typingAction(key('n', { isComposing: true })), 'focus');
});
