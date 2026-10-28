import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

/**
 * 同一份代码打两个 VSIX：
 *   vscode185 —— engines ^1.85.0
 *   vscode174 —— engines ^1.74.0（兼容 1.74.2）
 *
 * 代码本身按 1.74 的 API 编译，因此两个包功能完全一致，只是声明的引擎范围不同。
 */

interface Variant {
  suffix: string;
  engine: string;
  displayName: string;
}

const root = resolve(__dirname, '..', '..');
const distRoot = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
const vsceCli = join(root, 'node_modules', '@vscode', 'vsce', 'vsce');

const variants: Variant[] = [
  {
    suffix: 'vscode185',
    engine: '^1.85.0',
    displayName: 'AutoMod Language Support (VS Code 1.85+)',
  },
  {
    suffix: 'vscode174',
    engine: '^1.74.0',
    displayName: 'AutoMod Language Support (VS Code 1.74+)',
  },
];

for (const variant of variants) {
  const stage = join(distRoot, variant.suffix);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  cpSync(join(root, 'out', 'src'), join(stage, 'out', 'src'), { recursive: true });
  cpSync(join(root, 'syntaxes'), join(stage, 'syntaxes'), { recursive: true });
  cpSync(join(root, 'language-configuration.json'), join(stage, 'language-configuration.json'));
  cpSync(join(root, 'README.md'), join(stage, 'README.md'));
  cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE.txt'));

  const devDependencies = {
    ...(pkg.devDependencies as Record<string, string>),
    '@types/vscode': variant.engine.replace('^', ''),
  };

  const variantPkg = {
    ...pkg,
    displayName: variant.displayName,
    engines: { vscode: variant.engine },
    devDependencies,
  };
  writeFileSync(join(stage, 'package.json'), `${JSON.stringify(variantPkg, null, 2)}\n`, 'utf8');

  const output = join(root, `automod-language-${String(pkg.version)}-${variant.suffix}.vsix`);
  console.log(`\n[${variant.suffix}] packaging ${output}`);
  const result = spawnSync(
    process.execPath,
    [vsceCli, 'package', '--no-dependencies', '-o', output],
    { cwd: stage, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nall variants packaged.');
