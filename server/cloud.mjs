import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function supervise(commands) {
  const children = commands.map(([command, ...args]) => spawn(command, args, { stdio: 'inherit' }));
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
    const timeout = setTimeout(() => {
      for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
    }, 8000);
    timeout.unref();
  }
  for (const child of children) {
    child.on('error', () => { console.error('Cloud service failed to start.'); stop(1); });
    child.on('exit', () => { if (!stopping) stop(1); });
  }
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(0));
  return children;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.MAYDAY_DB_URL?.startsWith('jdbc:postgresql:')) {
    console.error('Cloud deployment requires a persistent PostgreSQL database.');
    process.exitCode = 1;
  } else {
    supervise([['java', '-jar', 'backend/app.jar'], [process.execPath, 'server.mjs']]);
  }
}
