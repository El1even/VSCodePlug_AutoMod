import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INITIAL, Registry, parseRawGrammar } from 'vscode-textmate';
import type { IToken } from 'vscode-textmate';
import * as oniguruma from 'vscode-oniguruma';

const grammarPath = join(__dirname, '..', '..', 'syntaxes', 'automod.tmLanguage.json');

let registryPromise: Promise<Registry> | undefined;

async function getRegistry(): Promise<Registry> {
  if (!registryPromise) {
    registryPromise = (async () => {
      const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');
      const wasm = readFileSync(wasmPath);
      const buffer = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer;
      await oniguruma.loadWASM(buffer);
      return new Registry({
        onigLib: Promise.resolve({
          createOnigScanner: (sources: string[]) => new oniguruma.OnigScanner(sources),
          createOnigString: (value: string) => new oniguruma.OnigString(value),
        }),
        loadGrammar: async (scopeName: string) => {
          if (scopeName !== 'source.automod') {
            return null;
          }
          return parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath);
        },
      });
    })();
  }
  return registryPromise;
}

const scopeOf = (tokens: IToken[], line: string, index: number): string => {
  const token = tokens.find((item) => item.startIndex <= index && index < item.endIndex);
  assert.ok(token, `位置 ${index}（${line}）没有 token`);
  return token.scopes[token.scopes.length - 1];
};

async function tokenize(line: string): Promise<IToken[]> {
  const registry = await getRegistry();
  const grammar = await registry.loadGrammar('source.automod');
  assert.ok(grammar, '语法未能加载');
  return grammar.tokenizeLine(line, INITIAL).tokens;
}

test('语法能被 vscode-textmate 加载（Oniguruma 正则合法）', async () => {
  const tokens = await tokenize('begin process P');
  assert.ok(tokens.length > 0);
});

test('begin + 系统类型 + 块名着色', async () => {
  const line = 'begin process P';
  const tokens = await tokenize(line);
  assert.equal(scopeOf(tokens, line, line.indexOf('begin')), 'keyword.control.automod');
  assert.equal(scopeOf(tokens, line, line.indexOf('process')), 'keyword.other.system-type.automod');
  assert.equal(scopeOf(tokens, line, line.indexOf(' P') + 1), 'entity.name.type.automod');
});

test('逻辑块名与声明着色', async () => {
  const line = 'begin P_station';
  const tokens = await tokenize(line);
  assert.equal(scopeOf(tokens, line, line.indexOf('P_station')), 'entity.name.function.automod');

  const declaration = 'integer var_count';
  const declTokens = await tokenize(declaration);
  assert.equal(
    scopeOf(declTokens, declaration, declaration.indexOf('integer')),
    'storage.type.automod',
  );
  assert.equal(
    scopeOf(declTokens, declaration, declaration.indexOf('var_count')),
    'variable.other.declaration.automod',
  );
});

test('注释、字符串、数字、内建函数着色', async () => {
  const comment = '! note here';
  assert.equal(
    scopeOf(await tokenize(comment), comment, comment.indexOf('note')),
    'comment.line.automod',
  );

  const string = 'print "hello"';
  assert.equal(
    scopeOf(await tokenize(string), string, string.indexOf('"hello"')),
    'string.quoted.double.automod',
  );

  const number = 'wait for 12.5 sec';
  assert.equal(
    scopeOf(await tokenize(number), number, number.indexOf('12.5')),
    'constant.numeric.automod',
  );

  const builtin = 'set x = random()';
  assert.equal(
    scopeOf(await tokenize(builtin), builtin, builtin.indexOf('random')),
    'support.function.automod',
  );
});

test('语句关键字着色', async () => {
  const line = 'move load to P_station';
  const tokens = await tokenize(line);
  assert.equal(scopeOf(tokens, line, line.indexOf('move')), 'keyword.control.automod');
  assert.equal(scopeOf(tokens, line, line.indexOf('to')), 'keyword.control.automod');
});
