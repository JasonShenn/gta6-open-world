// main.ts — GOLDEN TIDE 提交程序（Node 22，标准库）：把 game/ 与 screenshots/ 拷到
// /output（本地用 MAKEFUN_OUTPUT_DIR 代替），再用 kit 自带的 vendor/makefun-game.ts
// 写 /output/dossier.json。运行：mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// 门限与 buildDossier 的参数一致（reference/gate.json）：截图最多 4 张、各 ≤256 KiB；
// game/ 最多 993 文件、共 ≤48 MiB、单路径 ≤1000 字节；dossier 文本 ≤163,840 字节。
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
