/**
 * AutoMod 语言定义 —— 全项目唯一事实源。
 *
 * 语法高亮（tmLanguage）与静态检查（lexer/parser）都从这里派生，
 * 因此当拿到真实 .mdl 模型、发现某个关键字或注释写法不一致时，
 * 只需要改这一个文件，然后重新 `npm run build`。
 *
 * 注意：本文件不依赖 vscode，可直接在 Node 中单测。
 */

export const LANGUAGE_ID = 'automod';
export const LANGUAGE_NAME = 'AutoMod';
export const SCOPE_NAME = 'source.automod';
export const FILE_EXTENSIONS = ['.mdl', '.automod'] as const;

/** 行注释前缀。AutoMod 使用 `!`；`!=` 被当作运算符而不是注释。 */
export const LINE_COMMENT = '!';
export const BLOCK_COMMENT_START = '/*';
export const BLOCK_COMMENT_END = '*/';

/** 控制流 / 语句关键字（大小写不敏感）。 */
export const CONTROL_KEYWORDS: readonly string[] = [
  'begin',
  'end',
  'model',
  'initialization',
  'function',
  'procedure',
  'arriving',
  'departing',
  'move',
  'into',
  'onto',
  'to',
  'from',
  'on',
  'via',
  'travel',
  'by',
  'send',
  'use',
  'order',
  'clone',
  'nlt',
  'wait',
  'for',
  'until',
  'be',
  'ordered',
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
  'open',
  'close',
  'writing',
  'save',
  'result',
  'as',
  'die',
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
  'and',
  'or',
  'not',
  'true',
  'false',
];

/** 声明语句开头的类型关键字。 */
export const DECLARATION_KEYWORDS: readonly string[] = [
  'integer',
  'real',
  'string',
  'boolean',
  'process',
  'queue',
  'load',
  'resource',
  'variable',
  'attribute',
  'entity',
  'table',
];

/** 复合结束标记（如 `endif`）到开启块的映射。 */
export const CLOSING_KEYWORDS: ReadonlyMap<string, string> = new Map([
  ['endif', 'if'],
  ['endwhile', 'while'],
  ['endfor', 'for'],
  ['endloop', 'loop'],
  ['endbegin', 'begin'],
]);

/** 模型级 `begin <type> <name>` 中允许的系统类型。 */
export const SYSTEM_TYPES: readonly string[] = [
  'process',
  'path mover',
  'conveyor',
  'as/rs',
  'agv',
  'bridge crane',
  'power and free',
  'kinematics',
  'loads',
  'resources',
  'queues',
  'variables',
  'general',
  'downtime',
  'shift',
  'schedule',
];

/** 内建函数：只用于高亮与“已知名字”白名单，不参与报错。 */
export const BUILTIN_FUNCTIONS: readonly string[] = [
  'abs',
  'min',
  'max',
  'round',
  'trunc',
  'floor',
  'ceil',
  'sqrt',
  'exp',
  'log',
  'mod',
  'random',
  'uniform',
  'normal',
  'oneof',
  'time',
  'clock',
  'dist',
  'str',
  'num',
];

/** 判定“语句”的起始关键字（parser 用）。 */
export const STATEMENT_KEYWORDS: readonly string[] = [
  'move',
  'travel',
  'wait',
  'set',
  'inc',
  'dec',
  'create',
  'call',
  'return',
  'stop',
  'terminate',
  'goto',
  'exit',
  'print',
];

/** 会开启一个需要 `end` 关闭的块的关键字（parser 用）。 */
export const OPENER_KEYWORDS: readonly string[] = ['begin', 'if', 'while', 'for'];

const LOWER = (value: string): string => value.toLowerCase();

/** 所有关键字的集合（小写）。 */
export const KEYWORD_SET: ReadonlySet<string> = new Set(
  [...CONTROL_KEYWORDS, ...DECLARATION_KEYWORDS].map(LOWER),
);

/** 声明关键字集合（小写）。 */
export const DECLARATION_KEYWORD_SET: ReadonlySet<string> = new Set(
  DECLARATION_KEYWORDS.map(LOWER),
);

/** 内建函数集合（小写）。 */
export const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_FUNCTIONS.map(LOWER));

/** 系统类型集合（小写，可能包含空格与 `/`）。 */
export const SYSTEM_TYPE_SET: ReadonlySet<string> = new Set(SYSTEM_TYPES.map(LOWER));

/**
 * 在 `begin` 之后尝试识别系统类型（可能由多个单词组成）。
 * 返回命中的类型与消耗的 token 数；未命中返回 undefined。
 */
export function matchSystemType(words: readonly string[]): { type: string; consumed: number } | undefined {
  // 从最长的组合开始尝试，避免 "path mover" 被拆成 "path"。
  for (let take = Math.min(3, words.length); take >= 1; take--) {
    const candidate = words.slice(0, take).join(' ').toLowerCase();
    if (SYSTEM_TYPE_SET.has(candidate)) {
      return { type: candidate, consumed: take };
    }
  }
  return undefined;
}
