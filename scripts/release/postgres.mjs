import { spawnSync } from 'node:child_process';

export function postgres(sql, env, { json = false } = {}) {
  const result = spawnSync('psql',['-X','--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],
    { env, input:sql, encoding:'utf8', timeout:180000, maxBuffer:32*1024*1024 });
  if (result.error || result.status !== 0) {
    throw new Error(safePostgresError(result.stderr || result.error?.message,env.PGPASSWORD));
  }
  return json ? JSON.parse(result.stdout.trim()) : result.stdout.trim();
}

export function sqlLiteral(value) { return "'"+String(value).replaceAll("'","''")+"'"; }

export function safePostgresError(value,password='') {
  // DETAIL/CONTEXT can contain complete production rows or SQL with credentials.
  const text=String(value || 'Postgres command failed');
  const summary=text.split(/\r?\n/).find(line=>/^ERROR:/.test(line)) ?? 'Postgres connection or command failed.';
  return (password?summary.replaceAll(password,'[redacted]'):summary)
    .replace(/eyJ[A-Za-z0-9_.-]+|sb_secret_[A-Za-z0-9_-]+|[\w.+-]+@[\w.-]+\.[A-Za-z]+/g,'[redacted]').slice(0,500);
}
