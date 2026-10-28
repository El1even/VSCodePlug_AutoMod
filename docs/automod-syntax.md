# AutoMod 语言要点（据 AutoMod 12.6 官方 Syntax Help 整理）

本文件是**要点摘要**，不是手册原文。原始帮助位于本机 `C:\AutoMod\12_6\help`，未纳入仓库。

## 源文件

- `.m`：AutoMod 逻辑（过程、子程序、函数），本扩展的处理对象。
- `.c`：用户自定义 C 函数。
- 一个 `.m` 文件可以包含任意多个过程、子程序和函数。

## 注释

- 行注释：`//` 到行尾。
- 块注释：`/* … */`，可跨行。

## 块结构

- `begin … end` 是**复合动作**的分组：多条语句需要成组时使用。
- `if … then`、`if … then … else`、`while … do`、`do … until`、`for each … do` **自身不需要 `end`**；
  多条语句时写成 `... then begin … end`。
- `begin` 可以匿名（仅作分组）。
- 逻辑块头部常见形式：
  - `begin P_x arriving`
  - `begin P_x arriving procedure`
  - `begin P_x leaving procedure`
  - `begin F_x function`
  - `begin S_x subroutine`
  - `begin model initialization function`

## 运算符与条件

- 关系运算符：`=`（或 `is`）、`<>`、`<=`、`>=`、`<`、`>`。
- 逻辑运算符：`and`、`or`；`and` 优先级高于 `or`，括号优先。
- 算术：`+ - * / % ^`。

## 动作（Actions）

`add`、`break`、`bring up`、`call`、`cancel`、`choose`、`claim`、`clone`、`close`、
`configure`、`continue`、`create`、`decrement`、`delete`、`dispatch`、`display`、
`do … until`、`for each`、`free`、`get`、`if … then`、`increment`、`insert`、`move`、
`open`、`order`、`plot`、`preempt`、`print`、`read`、`release`、`remove`、`reserve`、
`return`、`rotate`、`scale`、`schedule`、`send`、`set`、`tabulate`、`take down`、
`terminate`、`translate`、`travel`、`undisplay`、`use`、`wait`、`wait to be ordered`、`while … do`。

注意：`send` 之后的语句不会执行（load 已离开当前 process）。

## 分布

`uniform`、`normal`、`exponential`、`gamma`、`lognormal`、`triangular`、`weibull`、
`constant`、`oneof`、`nextof`；源码中常见简写 `u`、`n`、`e`（如 `use R for u 5,1 min`）。

## 常用函数

- C 数学库：`abs`、`fabs`、`exp`、`log`、`log10`、`pow`、`sin`、`cos`、`tan`、`sqrt`。
- 类型与其它：`oneof`、`nextof`、`random` 等。

## 对本扩展的影响

- 注释语法由 `!` 改为 `//`（0.1.4 起）。
- `begin`/`end` 支持与其它语句同行（`... then begin`、`do begin`）。
- 关键字表按官方 Actions 列表补全。
