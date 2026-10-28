import {
  BUILTIN_FUNCTIONS,
  CONTROL_KEYWORDS,
  DECLARATION_KEYWORDS,
  LANGUAGE_NAME,
  SCOPE_NAME,
  SYSTEM_TYPES,
} from '../language/spec';

export interface TextMateGrammar {
  $schema: string;
  name: string;
  scopeName: string;
  patterns: Array<{ include: string }>;
  repository: Record<string, unknown>;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 系统类型可能包含空格，转成正则里的 `\s+`。 */
const systemTypeRegex = (): string =>
  [...SYSTEM_TYPES]
    .sort((a, b) => b.length - a.length)
    .map((type) => escapeRegex(type).replace(/\\? /g, '\\s+'))
    .join('|');

const alternation = (words: readonly string[]): string => words.map(escapeRegex).join('|');

const NAME = '[A-Za-z_$][A-Za-z0-9_$]*';

export function buildGrammar(): TextMateGrammar {
  return {
    $schema:
      'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: LANGUAGE_NAME,
    scopeName: SCOPE_NAME,
    patterns: [
      { include: '#comments' },
      { include: '#strings' },
      { include: '#blocks' },
      { include: '#declarations' },
      { include: '#numbers' },
      { include: '#keywords' },
      { include: '#builtins' },
      { include: '#operators' },
    ],
    repository: {
      comments: {
        patterns: [
          {
            name: 'comment.block.automod',
            match: '/\\*[\\s\\S]*?\\*/',
          },
          {
            name: 'invalid.illegal.unterminated-comment.automod',
            match: '/\\*[\\s\\S]*',
          },
          {
            name: 'comment.line.automod',
            match: '!(?!=).*$',
          },
        ],
      },
      strings: {
        patterns: [
          {
            name: 'string.quoted.double.automod',
            match: '"(?:\\\\.|[^"\\\\\\n])*"',
          },
          {
            name: 'string.quoted.single.automod',
            match: "'(?:\\\\.|[^'\\\\\\n])*'",
          },
          {
            name: 'invalid.illegal.unterminated-string.automod',
            match: '"(?:\\\\.|[^"\\\\\\n])*$',
          },
        ],
      },
      blocks: {
        patterns: [
          {
            // begin path mover PM / begin process P
            match: `(?i:\\bbegin)\\s+(${systemTypeRegex()})\\s+(?:system\\s+)?(${NAME})`,
            captures: {
              '0': { name: 'keyword.control.automod' },
              '1': { name: 'keyword.other.system-type.automod' },
              '2': { name: 'entity.name.type.automod' },
            },
          },
          {
            // begin model demo / begin procedure P_x
            match: `(?i:\\bbegin)\\s+(model|procedure)\\s+(${NAME})`,
            captures: {
              '0': { name: 'keyword.control.automod' },
              '1': { name: 'keyword.other.automod' },
              '2': { name: 'entity.name.function.automod' },
            },
          },
          {
            // begin P_station
            match: `(?i:\\bbegin)\\s+(${NAME})`,
            captures: {
              '0': { name: 'keyword.control.automod' },
              '1': { name: 'entity.name.function.automod' },
            },
          },
        ],
      },
      declarations: {
        patterns: [
          {
            // 声明：integer var_count / queue Q1 / load LoadA
            // 名字前加否定前瞻，避免把 `load to P` 里的 to 当成声明名。
            match: `(?i:\\b(${alternation(DECLARATION_KEYWORDS)}))\\s+((?!(?i:to|of|for|by|via|type|then|do|else|end|begin|and|or|not)\\b)${NAME})`,
            captures: {
              '1': { name: 'storage.type.automod' },
              '2': { name: 'variable.other.declaration.automod' },
            },
          },
        ],
      },
      numbers: {
        patterns: [
          {
            name: 'constant.numeric.automod',
            match: '(?<![A-Za-z0-9_$])\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?',
          },
        ],
      },
      keywords: {
        patterns: [
          {
            name: 'keyword.control.automod',
            match: `(?i)\\b(${alternation([
              'begin',
              'end',
              'model',
              'procedure',
              'move',
              'to',
              'via',
              'travel',
              'by',
              'wait',
              'for',
              'until',
              'set',
              'inc',
              'dec',
              'create',
              'of',
              'type',
              'call',
              'return',
              'stop',
              'terminate',
              'goto',
              'exit',
              'print',
              'if',
              'then',
              'else',
              'while',
              'do',
              'loop',
              'repeat',
              'otherwise',
              'case',
              'when',
              'break',
              'continue',
            ])})\\b`,
          },
          {
            name: 'keyword.operator.word.automod',
            match: `(?i)\\b(${alternation(['and', 'or', 'not'])})\\b`,
          },
          {
            name: 'constant.language.automod',
            match: `(?i)\\b(${alternation(['true', 'false'])})\\b`,
          },
          {
            name: 'keyword.other.end.automod',
            match: `(?i)\\b(${alternation([
              'endif',
              'endwhile',
              'endfor',
              'endloop',
              'endbegin',
            ])})\\b`,
          },
        ],
      },
      builtins: {
        patterns: [
          {
            name: 'support.function.automod',
            match: `(?i)\\b(${alternation(BUILTIN_FUNCTIONS)})\\s*(?=\\()`,
          },
        ],
      },
      operators: {
        patterns: [
          {
            name: 'keyword.operator.automod',
            match: '<>|!=|<=|>=|==|=|\\+|-|\\*|/|%|\\^|<|>|&|\\||~',
          },
        ],
      },
    },
  };
}
