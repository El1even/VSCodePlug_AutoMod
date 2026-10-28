import { parse } from '../language/parser';
import { collectSymbols } from '../language/symbols';
import { createRuleSettings } from './settings';
import { structuralDiagnostics } from './rules/structural';
import { referenceDiagnostics } from './rules/references';
import { qualityDiagnostics } from './rules/quality';
import type { AnalyzeOptions, Diagnostic } from './types';

export const DEFAULT_MAX_FILE_SIZE_KB = 2048;
export const DEFAULT_MAX_DIAGNOSTICS = 500;

export type SkipReason = 'disabled' | 'empty' | 'too-large';

export interface AnalyzeResult {
  diagnostics: Diagnostic[];
  skipped?: SkipReason;
}

/**
 * 纯函数分析入口：不依赖 vscode，便于单元测试。
 */
export function analyzeDetailed(source: string, options: AnalyzeOptions = {}): AnalyzeResult {
  if (options.enabled === false) {
    return { diagnostics: [], skipped: 'disabled' };
  }
  if (source.trim().length === 0) {
    return { diagnostics: [], skipped: 'empty' };
  }

  const maxFileSizeKB = options.maxFileSizeKB ?? DEFAULT_MAX_FILE_SIZE_KB;
  if (maxFileSizeKB > 0 && source.length / 1024 > maxFileSizeKB) {
    return { diagnostics: [], skipped: 'too-large' };
  }

  const settings = createRuleSettings({
    enabled: true,
    severity: options.severity,
    rules: options.rules,
    maxDiagnostics: options.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS,
  });

  const model = parse(source);
  const symbols = collectSymbols(model);

  const all: Diagnostic[] = [
    ...structuralDiagnostics(model, settings),
    ...referenceDiagnostics(model, symbols, settings),
    ...qualityDiagnostics(model, settings),
  ];

  const seen = new Set<string>();
  const unique: Diagnostic[] = [];
  for (const diagnostic of all) {
    const key = `${diagnostic.code}:${diagnostic.range.start.line}:${diagnostic.range.start.character}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(diagnostic);
  }

  unique.sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return a.range.start.line - b.range.start.line;
    }
    if (a.range.start.character !== b.range.start.character) {
      return a.range.start.character - b.range.start.character;
    }
    return a.code.localeCompare(b.code);
  });

  return { diagnostics: unique.slice(0, settings.maxDiagnostics) };
}

export function analyze(source: string, options: AnalyzeOptions = {}): Diagnostic[] {
  return analyzeDetailed(source, options).diagnostics;
}
