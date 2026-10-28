import type { BlockNode, ParsedModel, Statement } from './parser';

export type SymbolKind =
  | 'model'
  | 'system'
  | 'block'
  | 'procedure'
  | 'process'
  | 'queue'
  | 'load'
  | 'resource'
  | 'variable'
  | 'attribute'
  | 'entity'
  | 'table';

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  /** 1-based 行号 */
  line: number;
  /** 0-based 列号 */
  col: number;
  /** 作用域路径，例如 `P` 或 `P/P_station`；顶层为 `<root>`。 */
  scope: string;
  block?: BlockNode;
}

export interface SymbolIndex {
  entries: SymbolEntry[];
  /** key 为小写名字 */
  byName: Map<string, SymbolEntry[]>;
  blockNames: Set<string>;
  systemNames: Set<string>;
  names: Set<string>;
  has(name: string): boolean;
  lookup(name: string): SymbolEntry[];
}

const BLOCK_KIND: Record<string, SymbolKind> = {
  model: 'model',
  system: 'system',
  begin: 'block',
  procedure: 'procedure',
};

const DECL_KIND: Record<string, SymbolKind> = {
  integer: 'variable',
  real: 'variable',
  string: 'variable',
  boolean: 'variable',
  variable: 'variable',
  process: 'process',
  queue: 'queue',
  load: 'load',
  resource: 'resource',
  attribute: 'attribute',
  entity: 'entity',
  table: 'table',
};

/** 由块链计算作用域名，例如 `P/P_station`。 */
export function scopeOf(block: BlockNode | undefined): string {
  const names: string[] = [];
  let current = block;
  while (current) {
    if (current.name) {
      names.unshift(current.name);
    }
    current = current.parent;
  }
  return names.length > 0 ? names.join('/') : '<root>';
}

export function collectSymbols(model: ParsedModel): SymbolIndex {
  const entries: SymbolEntry[] = [];
  const byName = new Map<string, SymbolEntry[]>();
  const blockNames = new Set<string>();
  const systemNames = new Set<string>();

  const add = (entry: SymbolEntry): void => {
    entries.push(entry);
    const key = entry.name.toLowerCase();
    const list = byName.get(key);
    if (list) {
      list.push(entry);
    } else {
      byName.set(key, [entry]);
    }
  };

  for (const block of model.blocks) {
    if (!block.name) {
      continue;
    }
    add({
      name: block.name,
      kind: BLOCK_KIND[block.kind] ?? 'block',
      line: block.line,
      col: block.col,
      scope: scopeOf(block.parent),
      block: block.parent,
    });
    blockNames.add(block.name.toLowerCase());
    if (block.kind === 'system') {
      systemNames.add(block.name.toLowerCase());
    }
  }

  for (const statement of model.statements) {
    const kind = DECL_KIND[statement.keyword];
    if (!kind) {
      continue;
    }
    const nameToken = statement.args[0];
    if (!nameToken || nameToken.kind !== 'identifier') {
      continue;
    }
    add({
      name: nameToken.text,
      kind,
      line: nameToken.line,
      col: nameToken.col,
      scope: scopeOf(statement.block),
      block: statement.block,
    });
  }

  const names = new Set(byName.keys());

  return {
    entries,
    byName,
    blockNames,
    systemNames,
    names,
    has(name: string): boolean {
      return byName.has(name.toLowerCase());
    },
    lookup(name: string): SymbolEntry[] {
      return byName.get(name.toLowerCase()) ?? [];
    },
  };
}

/** 判断一个 token 是否是“简单名字”（可参与引用检查）。 */
export function isSimpleName(token: { kind: string; text: string } | undefined): boolean {
  if (!token || token.kind !== 'identifier') {
    return false;
  }
  return /^[A-Za-z_$\u0080-\uFFFF][\w$\u0080-\uFFFF]*$/.test(token.text);
}

/** 取名字的首段，用于 `P.station` 这类写法。 */
export function nameRoot(name: string): string {
  const index = name.search(/[.:]/);
  return index < 0 ? name : name.slice(0, index);
}

export function collectDeclarations(model: ParsedModel): Statement[] {
  return model.statements.filter((statement) => DECL_KIND[statement.keyword] !== undefined);
}
