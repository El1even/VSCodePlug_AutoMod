import * as vscode from 'vscode';
import type { AnalyzeOptions, SeveritySetting } from './analysis/types';

type SeverityKey = 'structural' | 'references' | 'quality';

const DEFAULTS: Record<SeverityKey, SeveritySetting> = {
  structural: 'error',
  references: 'warning',
  quality: 'hint',
};

/**
 * 读取配置。`get('a.b.c')` 与 `get('a')` 在不同版本/场景下行为略有差异，
 * 这里先走点号路径，失败再回退到对象读取。
 */
function readSeverity(config: vscode.WorkspaceConfiguration, key: SeverityKey): SeveritySetting {
  const direct = config.get<SeveritySetting>(`diagnostics.severity.${key}`);
  if (direct !== undefined) {
    return direct;
  }
  const nested = config.get<{ severity?: Partial<Record<SeverityKey, SeveritySetting>> }>('diagnostics');
  return nested?.severity?.[key] ?? DEFAULTS[key];
}

function readRules(config: vscode.WorkspaceConfiguration): Record<string, boolean> {
  const direct = config.get<Record<string, boolean>>('diagnostics.rules');
  if (direct) {
    return direct;
  }
  const nested = config.get<{ rules?: Record<string, boolean> }>('diagnostics');
  return nested?.rules ?? {};
}

/** 从 VS Code 设置读取分析参数。 */
export function readAnalyzeOptions(): AnalyzeOptions {
  const config = vscode.workspace.getConfiguration('automod');
  const diagnostics = config.get<{ enable?: boolean }>('diagnostics');

  return {
    enabled: config.get<boolean>('diagnostics.enable') ?? diagnostics?.enable ?? true,
    severity: {
      structural: readSeverity(config, 'structural'),
      references: readSeverity(config, 'references'),
      quality: readSeverity(config, 'quality'),
    },
    rules: readRules(config),
    maxFileSizeKB: config.get<number>('maxFileSizeKB', 2048),
  };
}
