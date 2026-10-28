import type { ParsedModel } from '../../language/parser';
import type { Diagnostic } from '../types';
import type { RuleSettings } from '../settings';
import { makeDiagnostic } from '../settings';

/** 结构性检查：直接消费 parser 产出的 issues。 */
export function structuralDiagnostics(model: ParsedModel, settings: RuleSettings): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const issue of model.issues) {
    const severity = settings.severityFor(issue.code, 'structural', issue.severity);
    if (!severity) {
      continue;
    }
    diagnostics.push(
      makeDiagnostic({
        code: issue.code,
        message: issue.message,
        category: 'structural',
        severity,
        line: issue.line,
        col: issue.col,
        endLine: issue.endLine,
        endCol: issue.endCol,
      }),
    );
  }

  return diagnostics;
}
