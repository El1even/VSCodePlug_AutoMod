import * as vscode from 'vscode';
import { analyzeDetailed } from './analysis/analyze';
import type { AnalyzeResult } from './analysis/analyze';
import type { Severity } from './analysis/types';
import { readAnalyzeOptions } from './config';
import { LANGUAGE_ID } from './language/spec';

const DEBOUNCE_MS = 200;

let collection: vscode.DiagnosticCollection;
let statusItem: vscode.StatusBarItem;
const timers = new Map<string, NodeJS.Timeout>();

const isAutoModDocument = (document: vscode.TextDocument): boolean =>
  document.languageId === LANGUAGE_ID;

const toVsSeverity = (severity: Severity): vscode.DiagnosticSeverity => {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
};

function schedule(document: vscode.TextDocument, delay = DEBOUNCE_MS): void {
  if (!isAutoModDocument(document)) {
    return;
  }
  const key = document.uri.toString();
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    timers.delete(key);
    runCheck(document);
  }, delay);
  timers.set(key, timer);
}

function runCheck(document: vscode.TextDocument): void {
  if (!isAutoModDocument(document)) {
    collection.delete(document.uri);
    return;
  }

  const options = readAnalyzeOptions();
  const result = analyzeDetailed(document.getText(), options);

  const diagnostics = result.diagnostics.map((entry) => {
    const range = new vscode.Range(
      entry.range.start.line,
      entry.range.start.character,
      entry.range.end.line,
      entry.range.end.character,
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      entry.message,
      toVsSeverity(entry.severity),
    );
    diagnostic.code = entry.code;
    diagnostic.source = 'AutoMod';
    return diagnostic;
  });

  collection.set(document.uri, diagnostics);
  updateStatus(document, result, result.skipped);
}

function updateStatus(
  document: vscode.TextDocument,
  result: AnalyzeResult,
  skipped: AnalyzeResult['skipped'],
): void {
  const active = vscode.window.activeTextEditor?.document;
  if (!active || active.uri.toString() !== document.uri.toString()) {
    return;
  }

  if (skipped === 'too-large') {
    statusItem.text = '$(warning) AutoMod: 文件过大，已跳过检查';
  } else if (skipped === 'disabled') {
    statusItem.text = '$(circle-slash) AutoMod: 检查已关闭';
  } else {
    const count = result.diagnostics.length;
    statusItem.text = count === 0 ? '$(check) AutoMod' : `$(warning) AutoMod: ${count} 个问题`;
  }
  statusItem.show();
}

function refreshActiveStatus(): void {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || !isAutoModDocument(document)) {
    statusItem.hide();
    return;
  }
  const diagnostics = collection.get(document.uri) ?? [];
  statusItem.text =
    diagnostics.length === 0 ? '$(check) AutoMod' : `$(warning) AutoMod: ${diagnostics.length} 个问题`;
  statusItem.show();
}

function recheckAll(): void {
  for (const document of vscode.workspace.textDocuments) {
    if (isAutoModDocument(document)) {
      runCheck(document);
    }
  }
  refreshActiveStatus();
}

export function activate(context: vscode.ExtensionContext): void {
  collection = vscode.languages.createDiagnosticCollection('automod');
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.name = 'AutoMod';
  statusItem.command = 'workbench.actions.view.problems';

  context.subscriptions.push(collection, statusItem);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => schedule(document, 0)),
    vscode.workspace.onDidChangeTextDocument((event) => schedule(event.document)),
    vscode.workspace.onDidSaveTextDocument((document) => schedule(document, 0)),
    vscode.workspace.onDidCloseTextDocument((document) => {
      const key = document.uri.toString();
      const timer = timers.get(key);
      if (timer) {
        clearTimeout(timer);
        timers.delete(key);
      }
      collection.delete(document.uri);
    }),
    vscode.window.onDidChangeActiveTextEditor(() => refreshActiveStatus()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('automod')) {
        recheckAll();
      }
    }),
    vscode.commands.registerCommand('automod.checkFile', () => {
      const document = vscode.window.activeTextEditor?.document;
      if (document && isAutoModDocument(document)) {
        runCheck(document);
        refreshActiveStatus();
      } else {
        void vscode.window.showInformationMessage('当前文件不是 AutoMod 模型。');
      }
    }),
    vscode.commands.registerCommand('automod.associateFile', async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document) {
        return;
      }
      await vscode.languages.setTextDocumentLanguage(document, LANGUAGE_ID);
      schedule(document, 0);
    }),
  );

  for (const document of vscode.workspace.textDocuments) {
    if (isAutoModDocument(document)) {
      schedule(document, 0);
    }
  }
  refreshActiveStatus();
}

export function deactivate(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
}
