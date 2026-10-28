import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/language/lexer';

const kinds = (source: string): string[] =>
  tokenize(source)
    .tokens.filter((token) => token.kind !== 'eof')
    .map((token) => token.kind);

test('关键字大小写不敏感，保留原文', () => {
  const { tokens } = tokenize('BEGIN Process\nEND');
  assert.deepEqual(kinds('BEGIN Process\nEND'), ['keyword', 'keyword', 'keyword']);
  assert.equal(tokens[0].text, 'BEGIN');
});

test('! 是行注释，!= 是运算符', () => {
  const { tokens, errors } = tokenize('! note\nif a != b then');
  assert.equal(tokens[0].kind, 'comment');
  assert.equal(tokens[0].line, 1);
  const operators = tokens.filter((token) => token.kind === 'operator').map((token) => token.text);
  assert.deepEqual(operators, ['!=']);
  assert.equal(errors.length, 0);
});

test('字符串支持转义', () => {
  const source = String.raw`print "say \"hi\""`;
  const { tokens, errors } = tokenize(source);
  const string = tokens.find((token) => token.kind === 'string');
  assert.ok(string);
  assert.equal(string.text, String.raw`"say \"hi\""`);
  assert.equal(errors.length, 0);
});

test('未闭合字符串报 AM001', () => {
  const { errors } = tokenize('set name = "abc\nnext');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'AM001');
  assert.equal(errors[0].line, 1);
});

test('块注释跨行且记录结束位置', () => {
  const { tokens } = tokenize('a\n/* x\ny */\nb');
  const comment = tokens.find((token) => token.kind === 'comment');
  assert.ok(comment);
  assert.equal(comment.line, 2);
  assert.equal(comment.endLine, 3);
});

test('未闭合块注释报 AM001', () => {
  const { errors } = tokenize('a\n/* never closed');
  assert.equal(errors[0].code, 'AM001');
  assert.equal(errors[0].line, 2);
});

test('CRLF 与 BOM 处理', () => {
  const { tokens } = tokenize('\uFEFFa\r\nb\r\nc');
  const words = tokens.filter((token) => token.kind === 'identifier');
  assert.deepEqual(words.map((token) => [token.text, token.line, token.col]), [
    ['a', 1, 0],
    ['b', 2, 0],
    ['c', 3, 0],
  ]);
});

test('数字形态', () => {
  const { tokens } = tokenize('3.14 1e-3 42');
  const numbers = tokens.filter((token) => token.kind === 'number').map((token) => token.text);
  assert.deepEqual(numbers, ['3.14', '1e-3', '42']);
});
