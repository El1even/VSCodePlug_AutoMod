import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGrammar } from '../src/grammar/build';
import { CONTROL_KEYWORDS, DECLARATION_KEYWORDS, SYSTEM_TYPES } from '../src/language/spec';

const grammarPath = join(__dirname, '..', '..', 'syntaxes', 'automod.tmLanguage.json');

test('已提交的语法文件与生成结果一致', () => {
  const committed = readFileSync(grammarPath, 'utf8');
  const generated = `${JSON.stringify(buildGrammar(), null, 2)}\n`;
  assert.equal(committed, generated, '请运行 npm run build 重新生成语法文件');
});

test('语法结构合法', () => {
  const grammar = buildGrammar();
  assert.equal(grammar.scopeName, 'source.automod');
  const repository = grammar.repository as Record<string, unknown>;
  for (const pattern of grammar.patterns) {
    const key = pattern.include.slice(1);
    assert.ok(repository[key], `缺少 repository 项：${key}`);
  }
  assert.equal(JSON.parse(JSON.stringify(grammar)).name, 'AutoMod');
});

const collectStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, out);
    }
  }
  return out;
};

test('关键字与系统类型都进入语法', () => {
  const serialized = collectStrings(buildGrammar()).join('\n');
  for (const keyword of [...CONTROL_KEYWORDS, ...DECLARATION_KEYWORDS]) {
    assert.ok(serialized.includes(keyword), `语法缺少关键字：${keyword}`);
  }
  for (const type of SYSTEM_TYPES) {
    const token = type.replace(/ /g, '\\s+');
    assert.ok(serialized.includes(token), `语法缺少系统类型：${type}`);
  }
});

test('注释与字符串规则存在', () => {
  const serialized = JSON.stringify(buildGrammar());
  assert.ok(serialized.includes('comment.line.automod'));
  assert.ok(serialized.includes('comment.block.automod'));
  assert.ok(serialized.includes('string.quoted.double.automod'));
  assert.ok(serialized.includes('invalid.illegal.unterminated-string.automod'));
});
