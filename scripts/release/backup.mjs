import assert from 'node:assert/strict';
import { createCipheriv,createDecipheriv,randomBytes,createHash } from 'node:crypto';
import { createWriteStream,appendFileSync,writeFileSync,mkdirSync,rmSync,readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { releaseTarget,databaseEnvironment } from './targets.mjs';

const MAGIC=Buffer.from('HTPBACKUP1\n');
export function decryptBackup(bytes,key,aad) {
  assert.equal(bytes.subarray(0,MAGIC.length).equals(MAGIC),true,'Unknown backup format.');
  const offset=MAGIC.length,decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(offset,offset+12));
  decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(offset+12,-16)),decipher.final()]);
}

export async function backup(env=process.env) {
  const target=releaseTarget(env);assert.equal(target.name,'production');
  assert.equal(env.HTP_PRODUCTION_APPROVED,'true','Backup runs only after production approval.');
  const key=Buffer.from(env.HTP_BACKUP_KEY ?? '','base64');assert.equal(key.length,32,'Configure the private production backup key.');
  assert.match(env.HTP_RELEASE_SHA ?? '',/^[a-f0-9]{40}$/);
  mkdirSync('.netlify/release',{recursive:true,mode:0o700});
  const file='.netlify/release/production-before.dump.enc';
  const metadata={format:'HTPBACKUP1',projectRef:target.projectRef,release:env.HTP_RELEASE_SHA,createdAt:new Date().toISOString(),schemas:['public','auth','storage','supabase_migrations']};
  const aad=JSON.stringify(metadata),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));
  const pg=databaseEnvironment(env,target,{readOnly:true});
  const child=spawn('docker',['run','--rm',...['PGHOST','PGPORT','PGUSER','PGDATABASE','PGPASSWORD','PGSSLMODE','PGCONNECT_TIMEOUT','PGOPTIONS'].flatMap(k=>['--env',k]),
    'postgres:17.6','pg_dump','--format=custom','--no-owner','--no-acl',...metadata.schemas.flatMap(s=>['--schema',s])],{env:pg,stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',b=>{if(errors.length<3000)errors+=b.toString();});
  const completed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('Read-only backup failed; no migration may proceed.')));});
  const timer=setTimeout(()=>child.kill('SIGTERM'),8*60*1000);
  try {
    writeFileSync(file,Buffer.concat([MAGIC,iv]),{mode:0o600});
    await Promise.all([pipeline(child.stdout,cipher,createWriteStream(file,{flags:'a',mode:0o600})),completed]);
    appendFileSync(file,cipher.getAuthTag());
    // Authenticate and inspect the custom-format header before accepting the backup.
    const bytes=readFileSync(file);const plaintext=decryptBackup(bytes,key,aad);
    assert.equal(plaintext.subarray(0,5).toString(),'PGDMP','Not a PostgreSQL custom-format archive.');plaintext.fill(0);
    writeFileSync('.netlify/release/production-backup.json',JSON.stringify({metadata,aad,encryptedSha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n',{mode:0o600});
    console.log('PASS: read-only database backup encrypted and authenticated; no plaintext file written.');
  } catch(error){rmSync(file,{force:true});throw error;} finally{clearTimeout(timer);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))backup().catch(e=>{console.error(e.message);process.exitCode=1;});
