import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/language/parser';

const codes = (source: string): string[] => parse(source).issues.map((issue) => issue.code);

const wrap = (body: string): string => `begin model m\n${body}\nend model\n`;

test('嵌套 begin/end 正常', () => {
  const source = wrap('begin process P\nbegin A\nmove load to A\nend\nend');
  const model = parse(source);
  assert.deepEqual(model.issues, []);
  assert.equal(model.blocks.length, 3);
  assert.equal(model.topBlocks.length, 1);
  assert.equal(model.topBlocks[0].name, 'm');
});

test('多余的 end 报 AM002', () => {
  assert.ok(codes('begin model m\nend\nend\n').includes('AM002'));
});

test('缺少 end 报 AM003', () => {
  assert.ok(codes('begin model m\nbegin process P\n').includes('AM003'));
});

test('重复块名报 AM004', () => {
  const source = wrap('begin process P\nbegin A\nend\nbegin A\nend\nend');
  assert.ok(codes(source).includes('AM004'));
});

test('未知系统类型报 AM005，已知类型不报', () => {
  assert.ok(codes('begin model m\nbegin stacker crane SC\nend\nend model\n').includes('AM005'));
  assert.deepEqual(codes('begin model m\nbegin conveyor C\nend\nend model\n'), []);
});

test('end model 之后的内容报 AM006', () => {
  assert.ok(codes('begin model m\nend model\nleftover\n').includes('AM006'));
});

test('if/then/else/end 配对不误报', () => {
  const source = wrap(
    [
      'begin process P',
      'begin A',
      'if x > 1 then',
      'wait for 1 sec',
      'else',
      'wait for 2 sec',
      'end',
      'end',
      'end',
    ].join('\n'),
  );
  assert.deepEqual(parse(source).issues, []);
});

test('兼容 begin process system P 写法', () => {
  const model = parse('begin model m\nbegin process system P\nend\nend model\n');
  assert.deepEqual(model.issues, []);
  assert.equal(model.topBlocks[0].children[0].name, 'P');
  assert.equal(model.topBlocks[0].children[0].typeName, 'process');
});

test('语句归属最近一层块', () => {
  const model = parse(wrap('begin process P\nbegin A\nmove load to A\nend\nend'));
  const statement = model.statements.find((item) => item.keyword === 'move');
  assert.ok(statement);
  assert.equal(statement.block?.name, 'A');
});
