# AutoMod Language Support

AutoMod 逻辑控制程序（`.m`）的 VS Code 语法高亮与静态检查。

## 功能

- **语法高亮**：`begin`/`end` 逻辑块、系统类型（process、path mover、conveyor、AS/RS…）、块名、声明、关键字、字符串、注释、数字、运算符、内建函数。
- **静态检查**：编辑/保存时自动运行，结果显示在 Problems 面板与编辑器波浪线上，状态栏显示问题数。
- **编辑辅助**：`begin … end` 折叠、自动缩进、`//` 与 `/* */` 注释切换。

## 安装

扩展按 VS Code 版本提供两个包，功能完全一致，按你的 VS Code 版本选一个：

| 安装包 | 适用版本 |
|---|---|
| `automod-language-0.1.4-vscode185.vsix` | VS Code **≥ 1.85** |
| `automod-language-0.1.4-vscode174.vsix` | VS Code **1.74.x ~ 1.84.x**（含 1.74.2） |

```powershell
# 1.74.2 的机器
code --install-extension .\automod-language-0.1.4-vscode174.vsix

# 1.85 及以上的机器
code --install-extension .\automod-language-0.1.4-vscode185.vsix
```

装完后执行 **Developer: Reload Window**。若已装过旧版本，加 `--force` 覆盖。

开发调试：用 VS Code 打开本目录，按 `F5`，在 Extension Development Host 中打开 `test/fixtures` 下的文件。

## 文件关联

扩展默认把 `.m`（以及 `.mdl`、`.automod`）关联到 AutoMod。`.m` 同时被 MATLAB、Objective-C 等扩展占用，冲突时用下面任一方式指定：

- 命令面板执行 **AutoMod: 将当前文件关联为 AutoMod 模型**（只影响当前文件）；
- 或只给 AutoMod 目录做关联，其余 `.m` 保持原语言：

```json
{
  "files.associations": {
    "**/AutoMod/**/*.m": "automod"
  }
}
```

- 也可以点状态栏右下角的语言名 → **Change Language Mode** → AutoMod。

## 逻辑文件与模型文件

- `.m`：逻辑控制程序，通常是若干 `begin P_xxx … end` 块，**没有** `begin model … end model` 外壳，本扩展默认支持这种形态。
- `.mdl`：完整模型导出文件（含 `begin model` / 系统块），同样可以高亮和检查。

引用类检查（`AM101`~`AM104`）只基于**当前文件**建立符号表。逻辑文件里引用的 queue / resource 往往声明在模型文件中，跨文件无法解析，因此：

- 文件里没有任何声明时（纯逻辑文件），`AM101`/`AM102` 自动跳过；
- 只有文件里出现 `load` 声明时，才检查 `create` 的 load 类型；
- 其余引用检查如与你的工程习惯不符，可用 `automod.diagnostics.rules` 逐条关闭。

## 检查规则

结构性（默认 `error`）：

| 代码 | 说明 |
|------|------|
| AM001 | 字符串或块注释未闭合 |
| AM002 | 多余的 `end` |
| AM003 | `begin` 未闭合 |
| AM004 | 同一作用域内重复的块名 |
| AM006 | `end model` 之后仍有内容 |
| AM008 | 无法识别的字符 |
| AM011 | `end` 后的名称与 `begin` 不一致 |

引用性（默认 `warning`）：

| 代码 | 说明 |
|------|------|
| AM101 | `move`/`travel` 的目标在文件中没有声明 |
| AM102 | `create` 的 Load 类型没有声明（文件里有 load 声明时才检查） |
| AM103 | `call` 的过程没有定义 |
| AM104 | 同一作用域内重复声明 |

质量类（默认 `hint`）：

| 代码 | 说明 |
|------|------|
| AM201 | `stop`/`terminate`/`return` 之后的不可达代码 |
| AM202 | `wait for` 负数 |
| AM203 | 常量除零 |
| AM204 | 空的逻辑块 |

## 设置

| 设置 | 默认 | 说明 |
|------|------|------|
| `automod.diagnostics.enable` | `true` | 总开关 |
| `automod.diagnostics.severity.structural` | `error` | 结构性检查级别 |
| `automod.diagnostics.severity.references` | `warning` | 引用性检查级别 |
| `automod.diagnostics.severity.quality` | `hint` | 质量类检查级别 |
| `automod.diagnostics.rules` | `{}` | 逐条开关，如 `{"AM201": false}` |
| `automod.maxFileSizeKB` | `2048` | 超过则跳过检查 |

级别改成非默认值后，会对该分类下所有规则统一生效；保持默认值时按上表的推荐级别。

## 语法基准与已知限制

本版语法已用真实 `.m` 逻辑文件（cs / cv / kc / pm 四个工程）校准，并对照 AutoMod 12.6 官方 Syntax Help 补全了关键字、注释语法与块规则，摘要见 [docs/automod-syntax.md](docs/automod-syntax.md)。优先保证不误报：

- 关键字大小写不敏感；
- 同时接受 `//` 行注释与 `/* */` 块注释（与官方手册一致）；
- `if` / `while` **不以 `end` 结束**，分组用 `begin … end`；
- `begin` 允许匿名（只作为语句分组），不要求名称；
- 逻辑块头部支持 `begin P_x arriving`、`begin P_x arriving procedure`、`begin model initialization function`；
- 引用检查只在文件内出现声明时才启用，避免逻辑文件跨文件误报；
- 未识别的语句按普通语句处理，不报错。

若真实文件出现误报或漏报，只需调整 `src/language/spec.ts` 并重新 `npm run build`，词法与高亮语法会同步更新。

## 开发

```powershell
npm install        # 使用项目内 .npmrc，缓存写到 .npm-cache
npm run build      # tsc + 生成 syntaxes/automod.tmLanguage.json
npm test           # node:test 单元测试
npm run package    # 生成两个 VSIX（vscode185 / vscode174）
```

`npm run package` 会先在 `dist/` 下按变体暂存（改 engines 与显示名），再分别调用 vsce，产物在仓库根目录：

```
automod-language-0.1.4-vscode185.vsix   engines ^1.85.0
automod-language-0.1.4-vscode174.vsix   engines ^1.74.0
```

目录：

```
src/language/   spec（唯一事实源）、lexer、parser、symbols
src/analysis/   规则与 analyze 编排（不依赖 vscode，可单测）
src/grammar/    tmLanguage 生成器
src/extension.ts  诊断集合、防抖、命令、状态栏
scripts/        gen-grammar、package-variants
```

## License

MIT
