import { spawnSync } from 'node:child_process';

export function postgres(sql, env, { json = false } = {}) {
  const result = spawnSync('psql',['-X','--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],
    { env, input:sql, encoding:'utf8', timeout:180000, maxBuffer:32*1024*1024 });
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || 'Unknown Postgres failure')
      .replaceAll(env.PGPASSWORD,'[redacted]').replace(/eyJ[A-Za-z0-9_.-]+|sb_secret_[A-Za-z0-9_-]+/g,'[redacted]');
    throw new Error(detail.slice(0,3000));
  }
  return json ? JSON.parse(result.stdout.trim()) : result.stdout.trim();
}

export function sqlLiteral(value) { return "'"+String(value).replaceAll("'","''")+"'"; }
