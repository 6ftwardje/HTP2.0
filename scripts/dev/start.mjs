import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { developmentEnvironment } from './environment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = '.env.development.local';
const git = args => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Gitcontrole mislukt. Open een volledige repositorycheckout.');
  return r.stdout.trim();
};

try {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Gebruik Node.js 22, gelijk aan de project-CI.');
  if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Gebruik dev:check of dev:safe zonder extra argumenten.');
  if (!existsSync(path.join(root, file))) throw new Error('Maak .env.development.local vanuit developer-kit/01-setup/.env.development.example en vul beide stagingkeys privé in.');
  const state = path.join(root, '.netlify/state.json');
  const environment = developmentEnvironment({
    config: parseEnv(readFileSync(path.join(root, file), 'utf8')),
    inherited: process.env,
    branch: git(['branch', '--show-current']),
    remote: git(['remote', 'get-url', 'origin']),
    otherEnvFiles: ['.env', '.env.local', '.env.development', '.env.production', '.env.production.local'].filter(name => existsSync(path.join(root, name))),
    netlifySiteId: existsSync(state) ? JSON.parse(readFileSync(state, 'utf8')).siteId : undefined,
  });
  console.log('PASS: taakbranch, repository, localhost, staging-runtimeconfiguratie en uitgeschakelde integraties. Geen cloudwrites uitgevoerd.');
  if (!process.argv.includes('--check')) {
    const assets = spawnSync(process.execPath, ['scripts/copy-pdf-assets.mjs'], { cwd: root, env: environment, stdio: 'inherit' });
    if (assets.status !== 0) throw new Error('Lokale PDF-assets voorbereiden mislukt.');
    const port = new URL(environment.NEXT_PUBLIC_SITE_URL).port;
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], { cwd: root, env: environment, stdio: 'inherit' });
    child.on('error', () => { console.error('Lokale Next.js-start mislukt. Controleer npm ci en de poort.'); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  }
} catch (error) {
  // Never log env objects, parsed keys, child command env or raw credential-file contents.
  console.error(`STOP: ${error.code || error instanceof SyntaxError ? 'Lokaal bestand niet leesbaar of niet geldig.' : error.message}`);
  process.exitCode = 1;
}
