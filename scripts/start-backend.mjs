import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const libs = resolve(root, 'backend/build/libs');
const jar = existsSync(libs) && readdirSync(libs).find((name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'));
if (!jar) throw new Error('먼저 npm run backend:build를 실행하세요.');
const data = resolve(root, 'data');
mkdirSync(data, { recursive: true, mode: 0o700 });
const child = spawn('java', ['-jar', resolve(libs, jar)], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, MAYDAY_DB_URL: process.env.MAYDAY_DB_URL || `jdbc:h2:file:${data}/mayday;MODE=MySQL;DB_CLOSE_ON_EXIT=FALSE` },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code || 0; });
