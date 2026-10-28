import type { Diagnostic, Severity, SeveritySetting } from './types';
import { DEFAULT_SEVERITY } from './types';
import type { DiagnosticCategory } from './types';

export interface RuleSettings {
  enabled: boolean;
  maxDiagnostics: number;
  /** 规则被显式关闭时返回 false。 */
  isRuleEnabled(code: string): boolean;
  /** 返回 undefined 表示该诊断应被丢弃。 */
  severityFor(code: string, category: DiagnosticCategory, ruleDefault: Severity): Severity | undefined;
}

export function createRuleSettings(args: {
  enabled?: boolean;
  severity?: Partial<Record<DiagnosticCategory, SeveritySetting>>;
  rules?: Record<string, boolean>;
  maxDiagnostics?: number;
}): RuleSettings {
  const enabled = args.enabled !== false;
  const maxDiagnostics = args.maxDiagnostics ?? 500;

  const severity: Record<DiagnosticCategory, SeveritySetting> = {
    structural: args.severity?.structural ?? DEFAULT_SEVERITY.structural,
    references: args.severity?.references ?? DEFAULT_SEVERITY.references,
    quality: args.severity?.quality ?? DEFAULT_SEVERITY.quality,
  };

  return {
    enabled,
    maxDiagnostics,
    isRuleEnabled(code: string): boolean {
      return enabled && args.rules?.[code] !== false;
    },
    severityFor(code: string, category: DiagnosticCategory, ruleDefault: Severity): Severity | undefined {
      if (!enabled || args.rules?.[code] === false) {
        return undefined;
      }
      const configured = severity[category];
      const isDefault = configured === DEFAULT_SEVERITY[category];
      // 默认：按每条规则自己的推荐级别；一旦用户改了分类级别，则该分类统一覆盖。
      const effective = isDefault ? ruleDefault : configured;
      return effective === 'none' ? undefined : effective;
    },
  };
}

export function makeDiagnostic(args: {
  code: string;
  message: string;
  category: DiagnosticCategory;
  severity: Severity;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}): Diagnostic {
  return {
    code: args.code,
    message: args.message,
    severity: args.severity,
    category: args.category,
    source: 'automod',
    range: {
      start: { line: Math.max(args.line - 1, 0), character: Math.max(args.col, 0) },
      end: {
        line: Math.max(args.endLine - 1, 0),
        character:
          args.endLine === args.line ? Math.max(args.endCol, args.col + 1) : Math.max(args.endCol, 0),
      },
    },
  };
}
