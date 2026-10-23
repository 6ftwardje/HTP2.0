import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { developmentEnvironment } from '../../scripts/dev/environment.mjs';

const key = role => `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ ref: 'pxxpciwnvfkxnkpttajp', role })).toString('base64url')}.synthetic`;
const config = () => ({ ...parseEnv(readFileSync(new URL('../../developer-kit/01-setup/.env.development.example', import.meta.url), 'utf8')), NEXT_PUBLIC_SUPABASE_ANON_KEY: key('anon'), SUPABASE_SERVICE_ROLE_KEY: key('service_role') });
const input = changes => ({ config: config(), inherited: {}, branch: 'codex/D1.0-example', remote: 'git@github.com:6ftwardje/HTP2.0.git', ...changes });

test('template plus synthetic staging credentials produces a development-only environment', () => {
  assert.equal(developmentEnvironment(input()).NODE_ENV, 'development');
});
test('protected branches and unrelated repositories are refused', () => {
  for (const branch of ['main', 'codex/staging', 'feature/no-task', '']) assert.throws(() => developmentEnvironment(input({ branch })), /taakbranch/);
  assert.throws(() => developmentEnvironment(input({ remote: 'https://github.com/other/repo.git' })), /Origin/);
});
test('production target and key project/role mismatch never appear in errors', () => {
  assert.throws(() => developmentEnvironment(input({ config: { ...config(), NEXT_PUBLIC_SUPABASE_URL: 'https://production.invalid' } })), /veilige ontwikkelwaarde/);
  const wrongKey = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ ref: 'wrong-project', role: 'service_role' })).toString('base64url')}.synthetic`;
  assert.throws(() => developmentEnvironment(input({ config: { ...config(), SUPABASE_SERVICE_ROLE_KEY: wrongKey } })), error => !error.message.includes(wrongKey) && /key hoort niet/.test(error.message));
  assert.throws(() => developmentEnvironment(input({ config: { ...config(), SUPABASE_SERVICE_ROLE_KEY: key('anon') } })), /vereiste rol/);
});
test('Next.js fallback files, inherited production settings and old deploy links are refused', () => {
  assert.throws(() => developmentEnvironment(input({ otherEnvFiles: ['.env.local'] })), /schone clone/);
  assert.throws(() => developmentEnvironment(input({ inherited: { SUPABASE_DB_PASSWORD: 'synthetic-do-not-log' } })), /Shellvariabele SUPABASE_DB_PASSWORD/);
  assert.throws(() => developmentEnvironment(input({ inherited: { NEXT_PUBLIC_SUPABASE_URL: 'synthetic' } })), /Shellvariabele/);
  assert.throws(() => developmentEnvironment(input({ netlifySiteId: 'old-site' })), /andere Netlify-site/);
});
test('external credentials and enabled outgoing side effects are refused', () => {
  for (const name of ['SUPABASE_DB_PASSWORD', 'NETLIFY_AUTH_TOKEN', 'STRIPE_SECRET_KEY', 'ANTHROPIC_API_KEY'])
    assert.throws(() => developmentEnvironment(input({ config: { ...config(), [name]: 'synthetic' } })), /hoort niet/);
  for (const [name, value] of [['EMAIL_MODE', 'live'], ['CHAT_MAINTENANCE_ENABLED', 'true'], ['PAID_PRODUCTS_ENABLED', '1']])
    assert.throws(() => developmentEnvironment(input({ config: { ...config(), [name]: value } })), /veilige ontwikkelwaarde/);
});
test('only explicit unprivileged localhost origins are accepted', () => {
  for (const url of ['https://hettradeplatform.be', 'http://localhost', 'http://localhost:80', 'http://localhost:3000/path', 'http://localhost:3000?x=1', 'http://user:password@localhost:3000', 'http://127.0.0.1:3000/#x'])
    assert.throws(() => developmentEnvironment(input({ config: { ...config(), NEXT_PUBLIC_SITE_URL: url } })), /localhost/);
  assert.equal(developmentEnvironment(input({ config: { ...config(), NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3105' } })).NEXT_PUBLIC_SITE_URL, 'http://127.0.0.1:3105');
});
test('missing or malformed credentials fail without exposing their values', () => {
  for (const value of ['', 'jouw-key', 'eyJ.malformed.synthetic', 'synthetic-private-string'])
    assert.throws(() => developmentEnvironment(input({ config: { ...config(), SUPABASE_SERVICE_ROLE_KEY: value } })), error => /SUPABASE_SERVICE_ROLE_KEY/.test(error.message) && (!value || !error.message.includes(value)));
});
