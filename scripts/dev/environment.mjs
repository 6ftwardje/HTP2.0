import { TARGETS } from '../release/targets.mjs';

const required = {
  HTP_ENVIRONMENT: 'staging',
  HTP_STAGING_SUPABASE_PROJECT_REF: TARGETS.staging.projectRef,
  NEXT_PUBLIC_SUPABASE_URL: `https://${TARGETS.staging.projectRef}.supabase.co`,
  EMAIL_MODE: 'disabled', CHAT_EMAIL_MODE: 'disabled',
  EMAIL_CAPTURE_ENABLED: 'false', EMAIL_MARKETING_ENABLED: 'false',
  EMAIL_PURCHASE_ENABLED: 'false', EMAIL_EXPIRY_ENABLED: 'false',
  EMAIL_MENTOR_ENABLED: 'false', CHAT_MAINTENANCE_ENABLED: 'false',
  PAID_PRODUCTS_ENABLED: '0',
};
const keys = ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const allowed = new Set([...Object.keys(required), ...keys, 'NEXT_PUBLIC_SITE_URL']);
const appVariable = /^(HTP_|SUPABASE_|NEXT_PUBLIC_|NETLIFY_|STRIPE_|MUX_|ANTHROPIC_|OPENAI_|RESEND_|EMAIL_|CHAT_|PAID_PRODUCTS_|PG[A-Z_]|DATABASE_URL$|SITE_ID$|BRANCH$|COMMIT_REF$|AVATAR_CLEANUP_SECRET$|BACKFILL_DRY_RUN_SIGNING_SECRET$|GITHUB_PROJECT_READ_TOKEN$)/;
const fail = message => { throw new Error(message); };

function checkKey(value, name, role) {
  if (!value || /jouw-|VUL_IN|placeholder/i.test(value)) fail(`${name}: vul de staging-runtimekey privé in.`);
  if (value.startsWith('eyJ')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url')); }
    catch { fail(`${name}: ongeldige keystructuur.`); }
    if (payload.ref !== TARGETS.staging.projectRef || payload.role !== role)
      fail(`${name}: key hoort niet bij het vereiste stagingproject/de vereiste rol.`);
  } else if (!value.startsWith(role === 'anon' ? 'sb_publishable_' : 'sb_secret_')) {
    fail(`${name}: onbekend keyformaat.`);
  }
  // Opaque keys carry no readable project reference; obtain them from the exact project.
}

export function developmentEnvironment({ config, inherited = {}, branch, remote, otherEnvFiles = [], netlifySiteId }) {
  if (!/^(feat|fix|docs|codex)\/[A-Z]\d+\.\d+-[a-z0-9-]+$/.test(branch ?? ''))
    fail('Gebruik een eigen taakbranch vanaf origin/codex/staging; main en codex/staging zijn geen werkbranches.');
  if (!/^(https:\/\/github\.com\/6ftwardje\/HTP2\.0(?:\.git)?\/?|git@github\.com:6ftwardje\/HTP2\.0(?:\.git)?|ssh:\/\/git@github\.com\/6ftwardje\/HTP2\.0(?:\.git)?)$/.test(remote ?? ''))
    fail('Origin moet de officiële 6ftwardje/HTP2.0-repository zijn.');
  if (otherEnvFiles.length) fail(`Andere Next.js-envbestanden aangetroffen: ${otherEnvFiles.join(', ')}. Gebruik een schone clone; verwijder geen onbekende credentials.`);
  if (netlifySiteId && netlifySiteId !== TARGETS.staging.siteId) fail('Deze checkout is aan een andere Netlify-site gekoppeld. Gebruik een schone clone.');
  for (const [name, value] of Object.entries(inherited)) {
    if (value && appVariable.test(name)) fail(`Shellvariabele ${name} kan de ontwikkelconfiguratie overschrijven. Start vanuit een schone shell.`);
  }
  if (inherited.NODE_ENV && inherited.NODE_ENV !== 'development') fail('NODE_ENV moet voor deze startopdracht leeg of development zijn.');
  for (const name of Object.keys(config)) if (!allowed.has(name)) fail(`Configuratievariabele ${name} hoort niet in deze onboardingroute.`);
  for (const [name, value] of Object.entries(required)) if (config[name] !== value) fail(`${name}: veilige ontwikkelwaarde ontbreekt of wijkt af.`);
  let origin;
  try { origin = new URL(config.NEXT_PUBLIC_SITE_URL); } catch { fail('NEXT_PUBLIC_SITE_URL moet een geldige localhost-origin zijn.'); }
  if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || Number(origin.port) < 1024)
    fail('NEXT_PUBLIC_SITE_URL moet http://localhost:<poort> of http://127.0.0.1:<poort> zijn, poort 1024–65535.');
  checkKey(config[keys[0]], keys[0], 'anon');
  checkKey(config[keys[1]], keys[1], 'service_role');
  return { ...inherited, ...config, NODE_ENV: 'development' };
}
