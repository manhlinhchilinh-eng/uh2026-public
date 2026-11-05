// Bật Firestore Emulator (project demo — không chạm dữ liệu thật) rồi chạy các file *.test.mjs.
// Cần JDK: mặc định C:\UH2026_tools\jdk (đặt JAVA_HOME để dùng chỗ khác). Firebase CLI cài global.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JAVA_HOME = process.env.JAVA_HOME || 'C:/UH2026_tools/jdk';
if (!existsSync(path.join(JAVA_HOME, 'bin'))) {
  console.error(`Không thấy JDK ở ${JAVA_HOME}. Đặt JAVA_HOME hoặc cài JDK 21.`);
  process.exit(1);
}
const env = { ...process.env, JAVA_HOME, PATH: `${path.join(JAVA_HOME, 'bin')}${path.delimiter}${process.env.PATH}` };
const tests = readdirSync(HERE).filter((f) => f.endsWith('.test.mjs')).join(' ');
const r = spawnSync(
  'firebase',
  ['emulators:exec', '--only', 'firestore', '--project', 'demo-ums-logbook', `"node --test --test-concurrency=1 ${tests}"`],
  { cwd: HERE, env, stdio: 'inherit', shell: true }
);
process.exit(r.status ?? 1);
