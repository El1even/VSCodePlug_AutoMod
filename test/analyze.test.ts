import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, analyzeDetailed } from '../src/analysis/analyze';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '..', '..', 'test', 'fixtures', name), 'utf8');

const codes = (source: string, options = {}): string[] =>
  analyze(source, options).map((diagnostic) => diagnostic.code);

test('合法模型没有诊断', () => {
  assert.deepEqual(analyze(fixture('valid.m')), []);
});

test('缺陷模型命中预期规则', () => {
  const result = codes(fixture('broken.m'));
  for (const expected of ['AM006', 'AM101', 'AM104', 'AM201', 'AM202', 'AM203', 'AM204']) {
    assert.ok(result.includes(expected), `缺少 ${expected}，实际：${result.join(',')}`);
  }
  assert.equal(result.filter((code) => code === 'AM101').length, 2);
});

test('真实语法形态（初始化函数、arriving procedure、匿名块）没有诊断', () => {
  assert.deepEqual(analyze(fixture('real-style.m')), []);
});

test('按规则关闭诊断', () => {
  const result = analyze(fixture('broken.m'), { rules: { AM201: false, AM202: false } });
  const found = result.map((diagnostic) => diagnostic.code);
  assert.ok(!found.includes('AM201'));
  assert.ok(!found.includes('AM202'));
  assert.ok(found.includes('AM203'));
});

test('分类级别可覆盖', () => {
  const result = analyze(fixture('broken.m'), { severity: { references: 'error' } });
  const reference = result.find((diagnostic) => diagnostic.code === 'AM101');
  assert.ok(reference);
  assert.equal(reference.severity, 'error');
});

test('分类级别设为 none 时该分类全部关闭', () => {
  const result = analyze(fixture('broken.m'), { severity: { structural: 'none' } });
  assert.ok(result.every((diagnostic) => !diagnostic.code.startsWith('AM00')));
});

test('总体开关与空文件', () => {
  assert.deepEqual(analyze(fixture('broken.m'), { enabled: false }), []);
  assert.equal(analyzeDetailed('   \n\n').skipped, 'empty');
});

test('大文件跳过检查', () => {
  const result = analyzeDetailed(fixture('valid.m'), { maxFileSizeKB: 0.01 });
  assert.equal(result.skipped, 'too-large');
  assert.deepEqual(result.diagnostics, []);
});

test('CRLF 文件同样可检查', () => {
  const source = fixture('broken.m').replace(/\n/g, '\r\n');
  const crlf = analyze(source).map((item) => `${item.code}:${item.range.start.line}`);
  const lf = analyze(fixture('broken.m')).map((item) => `${item.code}:${item.range.start.line}`);
  assert.deepEqual(crlf, lf);
});

test('纯逻辑文件（无 begin model 外壳）没有诊断', () => {
  assert.deepEqual(analyze(fixture('logic-only.m')), []);
});

test('诊断位置为 0-based 行号', () => {
  const result = analyze('begin model m\nend\nend\n');
  const extra = result.find((diagnostic) => diagnostic.code === 'AM002');
  assert.ok(extra);
  assert.equal(extra.range.start.line, 2);
});

test('常见写法不误报（arriving 逻辑块、create、注释）', () => {
  const source = [
    'begin model plant',
    '! 这是注释',
    'begin process P',
    '  integer var_jobs',
    '  load LoadA',
    '  queue Q_in',
    '',
    '  begin P_in arriving procedure',
    '    create 1 load of type LoadA to P_in',
    '  end',
    '',
    '  begin P_out arriving procedure',
    '    if var_jobs >= 10 then',
    '      begin',
    '        wait for 30 sec',
    '      end',
    '    else',
    '      begin',
    '        wait for 5 sec',
    '      end',
    '    move to P_in',
    '  end',
    'end',
    'end model',
  ].join('\n');
  assert.deepEqual(analyze(source), []);
});
