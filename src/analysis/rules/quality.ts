import type { BlockNode, ParsedModel, Statement } from '../../language/parser';
import { isTerminator } from '../../language/parser';
import type { Diagnostic, Severity } from '../types';
import type { RuleSettings } from '../settings';
import { makeDiagnostic } from '../settings';

const SEVERITY: Severity = 'hint';

/** 质量类检查：不可达代码、负数等待、常量除零、空逻辑块。 */
export function qualityDiagnostics(model: ParsedModel, settings: RuleSettings): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const emit = (code: string, message: string, line: number, col: number, endCol: number): void => {
    const severity = settings.severityFor(code, 'quality', SEVERITY);
    if (!severity) {
      return;
    }
    diagnostics.push(
      makeDiagnostic({
        code,
        message,
        category: 'quality',
        severity,
        line,
        col,
        endLine: line,
        endCol,
      }),
    );
  };

  // 按块分组语句
  const groups = new Map<BlockNode, Statement[]>();
  for (const statement of model.statements) {
    if (!statement.block) {
      continue;
    }
    const list = groups.get(statement.block);
    if (list) {
      list.push(statement);
    } else {
      groups.set(statement.block, [statement]);
    }
  }

  // AM201 终止语句之后的不可达代码
  for (const statements of groups.values()) {
    for (let index = 0; index < statements.length; index++) {
      if (!isTerminator(statements[index].keyword)) {
        continue;
      }
      const next = statements[index + 1];
      if (next) {
        emit(
          'AM201',
          `“${statements[index].keyword}” 之后的语句不会被执行`,
          next.line,
          next.col,
          next.col + Math.max(next.args[0]?.text.length ?? 1, 1),
        );
        break;
      }
      break;
    }
  }

  for (const statement of model.statements) {
    // AM202 wait for 负数
    if (statement.keyword === 'wait') {
      const forIndex = statement.args.findIndex((token) => token.text.toLowerCase() === 'for');
      if (forIndex >= 0) {
        const sign = statement.args[forIndex + 1];
        const value = statement.args[forIndex + 2];
        if (sign?.text === '-' && value?.kind === 'number') {
          emit(
            'AM202',
            'wait for 的时间是负数',
            value.line,
            value.col,
            value.col + value.text.length,
          );
        }
      }
    }

    // AM203 常量除零
    for (let index = 0; index < statement.tokens.length - 1; index++) {
      const token = statement.tokens[index];
      const divisor = statement.tokens[index + 1];
      if (
        (token.kind === 'operator' && (token.text === '/' || token.text === '%')) &&
        divisor.kind === 'number' &&
        Number(divisor.text) === 0
      ) {
        emit(
          'AM203',
          '除数为常量 0',
          divisor.line,
          divisor.col,
          divisor.col + divisor.text.length,
        );
      }
    }
  }

  // AM204 空逻辑块
  for (const block of model.blocks) {
    if (block.kind !== 'begin' && block.kind !== 'procedure') {
      continue;
    }
    if (block.children.length > 0) {
      continue;
    }
    const statements = groups.get(block);
    if (statements && statements.length > 0) {
      continue;
    }
    emit(
      'AM204',
      `逻辑块 “${block.name ?? '<unnamed>'}” 是空的`,
      block.line,
      block.col,
      block.col + 5,
    );
  }

  return diagnostics;
}
