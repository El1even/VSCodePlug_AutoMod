export type Severity = 'error' | 'warning' | 'info' | 'hint';
export type SeveritySetting = Severity | 'none';
export type DiagnosticCategory = 'structural' | 'references' | 'quality';

export interface Position {
  /** 0-based 行号 */
  line: number;
  /** 0-based 列号 */
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Diagnostic {
  code: string;
  message: string;
  severity: Severity;
  category: DiagnosticCategory;
  range: Range;
  source: string;
}

export interface AnalyzeOptions {
  enabled?: boolean;
  severity?: Partial<Record<DiagnosticCategory, SeveritySetting>>;
  /** 逐条规则开关，例如 { AM201: false } */
  rules?: Record<string, boolean>;
  maxFileSizeKB?: number;
  maxDiagnostics?: number;
}

export const DEFAULT_SEVERITY: Record<DiagnosticCategory, Severity> = {
  structural: 'error',
  references: 'warning',
  quality: 'hint',
};
