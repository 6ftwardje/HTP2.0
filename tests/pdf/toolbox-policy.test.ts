import{test}from'node:test';import assert from'node:assert/strict';
import{toolboxUrl,toolboxInput,validToolboxFile,toolboxFilename}from'../../lib/toolbox-policy';
test('external toolbox links accept HTTPS and reject active URLs, credentials and local endpoints',()=>{
 assert.equal(toolboxUrl('https://example.com/plan?q=a'),'https://example.com/plan?q=a');
 for(const url of ['javascript:alert(1)','data:text/plain,a','http://example.com','https://user:pass@example.com','https://127.0.0.1','https://2130706433','https://[::1]','https://localhost','https://foo.local','https://foo.internal','https://example.com:8443'])assert.equal(toolboxUrl(url),null,url);
 assert.equal(toolboxInput({title:'Plan',kind:'link',url:'javascript:bad'}),null);
});
test('explicit files are bounded downloads; protected PDFs cannot bypass their viewer as generic files',()=>{
 const text=new TextEncoder();assert.equal(validToolboxFile('plan.txt',text.encode('Synthetische lokale proef')),true);
 assert.equal(validToolboxFile('plan.csv',text.encode('a,b\n1,2')),true);
 assert.equal(validToolboxFile('plan.zip',Uint8Array.from([0x50,0x4b,3,4,0])),true);
 for(const [name,bytes]of [['plan.pdf',text.encode('%PDF-1.7')],['plan.txt',text.encode('%PDF-1.7')],['plan.zip',text.encode('not a zip')],['plan.txt',Uint8Array.from([0xff,0,2])],['plan.txt',new Uint8Array(3*1024*1024+1)]] as const)assert.equal(validToolboxFile(name,bytes),false);
 assert.equal(toolboxFilename('../plan.txt'),'_plan.txt');assert.equal(toolboxFilename('payload.html'),null);
});
