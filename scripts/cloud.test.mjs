import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('cloud supervisor fails closed and terminates its other service', async () => {
  const moduleUrl = new URL('../server/cloud.mjs', import.meta.url).href;
  const program = `import { supervise } from ${JSON.stringify(moduleUrl)};
    const children = supervise([[process.execPath, '-e', 'setTimeout(() => process.exit(1), 100)'],
      [process.execPath, '-e', 'setInterval(() => {}, 1000)']]);
    children[1].on('exit', () => console.log('peer-stopped'));`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program]);
  let output = '';
  child.stdout.on('data', (part) => { output += part; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
  try {
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(output, /peer-stopped/);
  } finally { clearTimeout(timeout); }
});
