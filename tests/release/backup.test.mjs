import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,createCipheriv } from 'node:crypto';
import { decryptBackup } from '../../scripts/release/backup.mjs';

test('a backup can be recovered only with the matching key and authenticated metadata; corruption is rejected',()=>{
  const key=randomBytes(32),iv=randomBytes(12),aad='synthetic production release metadata';
  const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));
  const bytes=Buffer.concat([Buffer.from('HTPBACKUP1\n'),iv,cipher.update('PGDMP synthetic recovery proof'),cipher.final(),cipher.getAuthTag()]);
  assert.equal(decryptBackup(bytes,key,aad).toString(),'PGDMP synthetic recovery proof');
  assert.throws(()=>decryptBackup(bytes,randomBytes(32),aad));
  assert.throws(()=>decryptBackup(bytes,key,'different release'));
  const changed=Buffer.from(bytes);changed[30]^=1;assert.throws(()=>decryptBackup(changed,key,aad));
});
