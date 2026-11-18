// main.ts — GOLDEN TIDE v4 的提交程序（Node 22，标准库 only）。
// 把 game/ 与 screenshots/ 原样拷进输出目录，再用 kit 的库写出 dossier.json（裁判读的那份摘要）。
// 本地跑：mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// 评分器里 /output 是写死的，MAKEFUN_OUTPUT_DIR 只在本地起作用。

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// 先清出输出目录，再拷游戏与截图。
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// 按评分器的上限写 dossier：正文最多 160 KiB，截图最多 4 张、各 256 KiB，
// game/ 最多 993 个文件、48 MiB，单个路径最多 1000 字节。
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
