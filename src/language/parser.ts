import {
  CLOSING_KEYWORDS,
  DECLARATION_KEYWORD_SET,
  KEYWORD_SET,
  matchSystemType,
} from './spec';
import type { Token } from './lexer';
import { tokenize } from './lexer';

export type Severity = 'error' | 'warning' | 'info' | 'hint';
export type DiagnosticCategory = 'structural' | 'references' | 'quality';

export type BlockKind =
  | 'model'
  | 'system'
  | 'begin'
  | 'procedure'
  | 'if'
  | 'while'
  | 'for';

export interface BlockNode {
  kind: BlockKind;
  /** 系统类型，例如 `process`、`path mover`。 */
  typeName?: string;
  name?: string;
  /** 归一化后的完整头部（小写），用于区分 `begin P_in` 与 `begin P_in arriving`。 */
  header?: string;
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
  parent?: BlockNode;
  children: BlockNode[];
}

export interface Statement {
  /** 小写关键字；普通赋值语句为 `=`。 */
  keyword: string;
  /** 本行全部 token（不含注释）。 */
  tokens: Token[];
  /** 关键字之后的 token。 */
  args: Token[];
  line: number;
  col: number;
  /** 所在的最近一层块（含 if/while 等）。 */
  block?: BlockNode;
}

export interface RawIssue {
  code: string;
  message: string;
  severity: Severity;
  category: DiagnosticCategory;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

export interface ParsedModel {
  source: string;
  tokens: Token[];
  /** 所有块（扁平，含 system）。 */
  blocks: BlockNode[];
  /** 模型级顶层块。 */
  topBlocks: BlockNode[];
  statements: Statement[];
  issues: RawIssue[];
  /** 被 `end model` 显式关闭。 */
  modelClosed: boolean;
}

const isWord = (token: Token | undefined): boolean =>
  token !== undefined && (token.kind === 'identifier' || token.kind === 'keyword');

/** 结束语句的关键字：其后的语句不可达。 */
const TERMINATORS = new Set(['stop', 'terminate', 'return', 'exit']);

export function parse(source: string): ParsedModel {
  const { tokens, errors } = tokenize(source);

  const issues: RawIssue[] = errors.map((error) => ({
    code: error.code,
    message: error.message,
    severity: 'error',
    category: 'structural' as const,
    line: error.line,
    col: error.col,
    endLine: error.endLine,
    endCol: error.endCol,
  }));

  const issue = (
    code: string,
    message: string,
    severity: Severity,
    token: Token,
    length = 5,
  ): void => {
    issues.push({
      code,
      message,
      severity,
      category: 'structural',
      line: token.line,
      col: token.col,
      endLine: token.line,
      endCol: token.col + Math.max(length, 1),
    });
  };

  // 按行分组，忽略注释与 EOF
  const byLine = new Map<number, Token[]>();
  for (const token of tokens) {
    if (token.kind === 'eof' || token.kind === 'comment') {
      continue;
    }
    const list = byLine.get(token.line);
    if (list) {
      list.push(token);
    } else {
      byLine.set(token.line, [token]);
    }
  }

  const lineNumbers = [...byLine.keys()].sort((a, b) => a - b);

  const blocks: BlockNode[] = [];
  const topBlocks: BlockNode[] = [];
  const statements: Statement[] = [];
  const stack: BlockNode[] = [];
  const seenNames = new Set<string>();
  let modelClosed = false;
  let reportedAfterModel = false;

  const currentBlock = (): BlockNode | undefined => stack[stack.length - 1];

  const attach = (node: BlockNode): void => {
    const parent = currentBlock();
    if (parent) {
      node.parent = parent;
      parent.children.push(node);
    } else {
      topBlocks.push(node);
    }
    blocks.push(node);
    stack.push(node);
  };

  const checkDuplicateName = (node: BlockNode): void => {
    if (!node.name) {
      return;
    }
    const parent = node.parent;
    const scopeId = parent ? `${parent.line}:${parent.col}` : 'root';
    // 用完整头部区分同一 process 的 arriving / departing 等不同逻辑块
    const identity = node.header ?? node.name.toLowerCase();
    const key = `${scopeId}:${identity}`;
    if (seenNames.has(key)) {
      issue('AM004', `重复的块名 “${node.name}”`, 'error', {
        kind: 'identifier',
        text: node.name,
        line: node.line,
        col: node.col,
        endLine: node.line,
        endCol: node.col,
      }, Math.max(node.name.length, 1));
    } else {
      seenNames.add(key);
    }
  };

  for (const lineNumber of lineNumbers) {
    const lineTokens = byLine.get(lineNumber)!;
    const first = lineTokens[0];
    const keyword = first.text.toLowerCase();

    if (modelClosed && !reportedAfterModel) {
      issue('AM006', '模型已结束（end model），之后仍有内容', 'error', first);
      reportedAfterModel = true;
    }

    if (keyword === 'begin') {
      const words = lineTokens
        .slice(1)
        .filter((token) => isWord(token))
        .map((token) => token.text);

      let kind: BlockKind = 'begin';
      let typeName: string | undefined;
      let name: string | undefined;

      const firstWord = words[0]?.toLowerCase();
      if (firstWord === 'model' && words[1]?.toLowerCase() === 'initialization') {
        // `begin model initialization function`：模型初始化函数，不是模型外壳
        kind = 'begin';
        name = 'initialization';
      } else if (firstWord === 'model') {
        kind = 'model';
        name = words[1];
      } else if (firstWord === 'procedure') {
        kind = 'procedure';
        name = words[1];
      } else {
        const systemMatch = matchSystemType(words);
        if (systemMatch) {
          kind = 'system';
          typeName = systemMatch.type;
          let nameIndex = systemMatch.consumed;
          // 兼容 `begin process system P` 这种把 "system" 也写出来的导出格式
          if (words[nameIndex]?.toLowerCase() === 'system' && words[nameIndex + 1]) {
            nameIndex += 1;
          }
          name = words[nameIndex];
        } else {
          // 逻辑块：`begin P_in arriving procedure`、`begin`（匿名块）等
          kind = 'begin';
          name = words[0];
        }
      }

      const node: BlockNode = {
        kind,
        typeName,
        name,
        header: words.length > 0 ? words.join(' ').toLowerCase() : undefined,
        line: first.line,
        col: first.col,
        parent: currentBlock(),
        children: [],
      };
      checkDuplicateName(node);
      attach(node);
      continue;
    }

    if (keyword === 'end' || CLOSING_KEYWORDS.has(keyword)) {
      const expected = CLOSING_KEYWORDS.get(keyword);
      if (stack.length === 0) {
        issue('AM002', '多余的 end：没有匹配的 begin', 'error', first);
        continue;
      }

      let node = stack.pop()!;
      if (expected) {
        while (node.kind !== expected && stack.length > 0) {
          node = stack.pop()!;
        }
        if (node.kind !== expected) {
          issue('AM007', `end${expected} 缺少对应的 ${expected} 块`, 'warning', first);
        }
      }

      node.endLine = first.endLine;
      node.endCol = first.endCol;

      if (node.kind === 'model') {
        modelClosed = true;
      } else {
        const after = lineTokens[1];
        if (
          after &&
          after.kind === 'identifier' &&
          node.name &&
          after.text.toLowerCase() !== node.name.toLowerCase() &&
          after.text.toLowerCase() !== 'model'
        ) {
          issue(
            'AM011',
            `end 后的名称 “${after.text}” 与 begin 的 “${node.name}” 不一致`,
            'warning',
            after,
            after.text.length,
          );
        }
      }
      continue;
    }

    if (keyword === 'else') {
      // else / else if 都只是分支标记，不开启需要 end 的块
      continue;
    }

    // 普通语句 / 声明 / 赋值
    const statement: Statement = {
      keyword,
      tokens: lineTokens,
      args: lineTokens.slice(1),
      line: first.line,
      col: first.col,
      block: currentBlock(),
    };
    statements.push(statement);
  }

  for (const node of stack) {
    if (node.kind === 'if' || node.kind === 'while' || node.kind === 'for') {
      issue('AM007', `${node.kind} 块未闭合（缺少 end）`, 'warning', {
        kind: 'keyword',
        text: node.kind,
        line: node.line,
        col: node.col,
        endLine: node.line,
        endCol: node.col + node.kind.length,
      }, node.kind.length);
    } else {
      issue('AM003', 'begin 未闭合（缺少 end）', 'error', {
        kind: 'keyword',
        text: 'begin',
        line: node.line,
        col: node.col,
        endLine: node.line,
        endCol: node.col + 5,
      }, 5);
    }
  }

  return { source, tokens, blocks, topBlocks, statements, issues, modelClosed };
}

/** 供 quality 规则使用的终止语句判定。 */
export function isTerminator(keyword: string): boolean {
  return TERMINATORS.has(keyword);
}

/** 判断 token 是否是声明语句开头。 */
export function isDeclarationStatement(statement: Statement): boolean {
  return DECLARATION_KEYWORD_SET.has(statement.keyword);
}

/** 判断字符串是否是关键字（大小写不敏感）。 */
export function isKeyword(word: string): boolean {
  return KEYWORD_SET.has(word.toLowerCase());
}
