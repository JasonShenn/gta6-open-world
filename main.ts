// Solmar Heat 的提交程序（Node 22，只用标准库）：把本目录的 game/ 与
// screenshots/ 原样拷到 /output，再用 kit 自带的 vendor/makefun-game.ts
// 写出 /output/dossier.json（裁判读的那份摘要）。
// 2026-11-18 重建版：game/ 与 tests/ 均为本会话亲手重写，玩法与数值不变。
// 评分容器外用 MAKEFUN_OUTPUT_DIR 代替 /output：
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// 本地试玩：node serve.ts，然后打开 http://localhost:8080。

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// 仓库根目录（main.ts 所在目录）。
const here = fileURLToPath(new URL('.', import.meta.url));
// 输出目录：评分容器里是 /output，本地用环境变量指定。
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
// 游戏本体：game/ 全部静态文件。
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
// 截图：screenshots/ 里 4 张实拍图。
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// 写 dossier：上限与评分器 gate.json 一致（截图最多 4 张、每张 ≤256 KiB；
// game/ 最多 993 项、48 MiB；正文上限 160 KiB）。
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
