import {
  BLOCK_COMMENT_END,
  BLOCK_COMMENT_START,
  CLOSING_KEYWORDS,
  KEYWORD_SET,
  LINE_COMMENT,
} from './spec';

export type TokenKind =
  | 'keyword'
  | 'identifier'
  | 'number'
  | 'string'
  | 'comment'
  | 'operator'
  | 'punct'
  | 'error'
  | 'eof';

export interface Token {
  kind: TokenKind;
  text: string;
  /** 1-based 行号 */
  line: number;
  /** 0-based 列号 */
  col: number;
  endLine: number;
  endCol: number;
}

export interface LexError {
  code: string;
  message: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

export interface LexResult {
  tokens: Token[];
  errors: LexError[];
}

const TWO_CHAR_OPERATORS = ['<>', '!=', '<=', '>=', '==', '->', '::'];
const ONE_CHAR_OPERATORS = '+-*/%=<>^&|~!';
const PUNCTUATION = '()[],;:?.{}';

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';
const isIdentStart = (ch: string | undefined): boolean =>
  ch !== undefined && (/[A-Za-z_$]/.test(ch) || ch.charCodeAt(0) > 127);
const isIdentPart = (ch: string | undefined): boolean =>
  ch !== undefined && (/[A-Za-z0-9_$]/.test(ch) || ch.charCodeAt(0) > 127);

/**
 * 容错词法分析：任何输入都不会抛异常，无法识别的内容产出 error token。
 * 换行不产出 token，语句按 token 的 line 分组。
 */
export function tokenize(source: string): LexResult {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const tokens: Token[] = [];
  const errors: LexError[] = [];
  const n = text.length;
  let i = 0;
  let line = 1;
  let col = 0;

  const step = (): void => {
    if (i >= n) {
      return;
    }
    const ch = text[i];
    if (ch === '\r') {
      i += text[i + 1] === '\n' ? 2 : 1;
      line += 1;
      col = 0;
    } else if (ch === '\n') {
      i += 1;
      line += 1;
      col = 0;
    } else {
      i += 1;
      col += 1;
    }
  };

  const advanceTo = (target: number): void => {
    while (i < target) {
      step();
    }
  };

  const push = (kind: TokenKind, startLine: number, startCol: number, startIndex: number): void => {
    tokens.push({
      kind,
      text: text.slice(startIndex, i),
      line: startLine,
      col: startCol,
      endLine: line,
      endCol: col,
    });
  };

  const pushError = (
    code: string,
    message: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
  ): void => {
    errors.push({ code, message, line: startLine, col: startCol, endLine, endCol });
  };

  while (i < n) {
    const ch = text[i];

    if (ch === ' ' || ch === '\t' || ch === '\f' || ch === '\v' || ch === '\r' || ch === '\n') {
      step();
      continue;
    }

    const startLine = line;
    const startCol = col;
    const startIndex = i;

    // 块注释
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf(BLOCK_COMMENT_END, i + BLOCK_COMMENT_START.length);
      if (close < 0) {
        advanceTo(n);
        push('comment', startLine, startCol, startIndex);
        pushError('AM001', '块注释未闭合，缺少 */', startLine, startCol, line, col);
      } else {
        advanceTo(close + BLOCK_COMMENT_END.length);
        push('comment', startLine, startCol, startIndex);
      }
      continue;
    }

    // 行注释：`!` 到行尾，但 `!=` 视为运算符
    if (ch === LINE_COMMENT && text[i + 1] !== '=') {
      while (i < n && text[i] !== '\r' && text[i] !== '\n') {
        step();
      }
      push('comment', startLine, startCol, startIndex);
      continue;
    }

    // 字符串（单/双引号）
    if (ch === '"' || ch === "'") {
      const quote = ch;
      step();
      let closed = false;
      while (i < n) {
        const current = text[i];
        if (current === '\\') {
          step();
          step();
          continue;
        }
        if (current === quote) {
          step();
          closed = true;
          break;
        }
        if (current === '\r' || current === '\n') {
          break;
        }
        step();
      }
      push('string', startLine, startCol, startIndex);
      if (!closed) {
        pushError('AM001', '字符串未闭合', startLine, startCol, line, col);
      }
      continue;
    }

    // 数字
    if (isDigit(ch)) {
      while (isDigit(text[i])) {
        step();
      }
      if (text[i] === '.' && isDigit(text[i + 1])) {
        step();
        while (isDigit(text[i])) {
          step();
        }
      }
      if (text[i] === 'e' || text[i] === 'E') {
        const save = i;
        step();
        if (text[i] === '+' || text[i] === '-') {
          step();
        }
        if (isDigit(text[i])) {
          while (isDigit(text[i])) {
            step();
          }
        } else {
          advanceTo(save);
        }
      }
      push('number', startLine, startCol, startIndex);
      continue;
    }

    // 标识符 / 关键字
    if (isIdentStart(ch)) {
      while (isIdentPart(text[i])) {
        step();
      }
      const word = text.slice(startIndex, i).toLowerCase();
      const kind: TokenKind =
        KEYWORD_SET.has(word) || CLOSING_KEYWORDS.has(word) ? 'keyword' : 'identifier';
      push(kind, startLine, startCol, startIndex);
      continue;
    }

    // 双字符运算符
    const two = text.slice(i, i + 2);
    if (TWO_CHAR_OPERATORS.includes(two)) {
      step();
      step();
      push('operator', startLine, startCol, startIndex);
      continue;
    }

    if (ONE_CHAR_OPERATORS.includes(ch)) {
      step();
      push('operator', startLine, startCol, startIndex);
      continue;
    }

    if (PUNCTUATION.includes(ch)) {
      step();
      push('punct', startLine, startCol, startIndex);
      continue;
    }

    step();
    push('error', startLine, startCol, startIndex);
    pushError('AM008', `无法识别的字符 “${ch}”`, startLine, startCol, line, col);
  }

  tokens.push({
    kind: 'eof',
    text: '',
    line,
    col,
    endLine: line,
    endCol: col,
  });

  return { tokens, errors };
}
