import type { ParsedModel } from '../../language/parser';
import type { SymbolIndex } from '../../language/symbols';
import { isSimpleName, nameRoot } from '../../language/symbols';
import type { Diagnostic } from '../types';
import type { RuleSettings } from '../settings';
import { makeDiagnostic } from '../settings';
import { BUILTIN_SET } from '../../language/spec';

const SEVERITY = 'warning' as const;

/**
 * 引用性检查。
 * 原则：只对“能确定判定”的引用报问题；拿不准的名字一律放过。
 */
export function referenceDiagnostics(
  model: ParsedModel,
  symbols: SymbolIndex,
  settings: RuleSettings,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const emit = (code: string, message: string, line: number, col: number, endCol: number): void => {
    const severity = settings.severityFor(code, 'references', SEVERITY);
    if (!severity) {
      return;
    }
    diagnostics.push(
      makeDiagnostic({
        code,
        message,
        category: 'references',
        severity,
        line,
        col,
        endLine: line,
        endCol,
      }),
    );
  };

  const isKnown = (name: string): boolean => {
    if (symbols.has(name)) {
      return true;
    }
    const root = nameRoot(name);
    if (root !== name && symbols.has(root)) {
      return true;
    }
    return BUILTIN_SET.has(name.toLowerCase());
  };

  // 逻辑文件（.m）里的变量、队列、资源通常声明在模型文件中；文件里没有任何声明时
  // 无从判断，跳过引用检查，避免跨文件误报。
  const DECLARED_KINDS = new Set([
    'process',
    'queue',
    'load',
    'resource',
    'variable',
    'attribute',
    'entity',
    'table',
  ]);
  const hasDeclarations = symbols.entries.some((entry) => DECLARED_KINDS.has(entry.kind));
  const hasLoadDeclarations = symbols.entries.some((entry) => entry.kind === 'load');

  const seenDeclarations = new Set<string>();

  for (const statement of model.statements) {
    if ((statement.keyword === 'move' || statement.keyword === 'travel') && hasDeclarations) {
      const toIndex = statement.args.findIndex((token) => token.text.toLowerCase() === 'to');
      const target = toIndex >= 0 ? statement.args[toIndex + 1] : undefined;
      if (isSimpleName(target) && !isKnown(target!.text)) {
        emit(
          'AM101',
          `目标 “${target!.text}” 在文件中没有声明`,
          target!.line,
          target!.col,
          target!.col + target!.text.length,
        );
      }
    }

    if (statement.keyword === 'create' && hasLoadDeclarations) {
      const typeIndex = statement.args.findIndex((token) => token.text.toLowerCase() === 'type');
      const typeToken = typeIndex >= 0 ? statement.args[typeIndex + 1] : undefined;
      if (isSimpleName(typeToken) && !isKnown(typeToken!.text)) {
        emit(
          'AM102',
          `Load 类型 “${typeToken!.text}” 在文件中没有声明`,
          typeToken!.line,
          typeToken!.col,
          typeToken!.col + typeToken!.text.length,
        );
      }
    }

    if (statement.keyword === 'call') {
      const target = statement.args.find((token) => isSimpleName(token));
      if (target && !symbols.blockNames.has(target.text.toLowerCase()) && !isKnown(target.text)) {
        emit(
          'AM103',
          `过程 “${target.text}” 在文件中没有定义`,
          target.line,
          target.col,
          target.col + target.text.length,
        );
      }
    }
  }

  // AM104 重复声明（同一作用域 + 同名 + 同类别）
  const declaredKinds = new Set([
    'process',
    'queue',
    'load',
    'resource',
    'variable',
    'attribute',
    'entity',
    'table',
  ]);

  for (const entry of symbols.entries) {
    if (!declaredKinds.has(entry.kind)) {
      continue;
    }
    const key = `${entry.scope}:${entry.name.toLowerCase()}:${entry.kind}`;
    if (seenDeclarations.has(key)) {
      emit(
        'AM104',
        `重复声明 “${entry.name}”（同一作用域内已存在同名 ${entry.kind}）`,
        entry.line,
        entry.col,
        entry.col + entry.name.length,
      );
    } else {
      seenDeclarations.add(key);
    }
  }

  return diagnostics;
}
