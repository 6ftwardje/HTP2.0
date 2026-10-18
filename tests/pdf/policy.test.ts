import assert from 'node:assert/strict';
import test from 'node:test';
import {pdfTitle,pdfReadingHtml,hasPdfReadingText,pdfWatermark,samePdfOrigin,boundedPdfBody,validPdfId} from '../../lib/pdf/policy';
test('PDF metadata strips active content while retaining semantic reading structure',()=>{
 assert.equal(pdfTitle('<b>  Plan</b>\n voor vandaag '),'Plan voor vandaag');assert.equal(pdfTitle('x'.repeat(161)),null);
 const html=pdfReadingHtml('<h2>Scenario</h2><script>secret()</script><p onclick="bad()">Een volledige uitleg voor de lezer.</p><img src="https://invalid.test/track"><table><tr><th scope="col">Risico</th><td>1%</td></tr></table>')!;
 assert.ok(html.includes('<h2>Scenario</h2>')&&html.includes('scope="col"'));assert.ok(!/script|onclick|img|track/.test(html));assert.equal(hasPdfReadingText(html),true);assert.equal(hasPdfReadingText('<p>kort</p>'),false);
});
test('PDF origin compares the browser origin with actual Host, never an internal Next URL',()=>{
 const request=(origin:string)=>new Request('http://internal-next:3000/api',{method:'POST',headers:{origin,host:'127.0.0.1:3118'}});
 assert.equal(samePdfOrigin(request('http://127.0.0.1:3118')),true);assert.equal(samePdfOrigin(request('https://attacker.invalid')),false);assert.equal(samePdfOrigin(request('http://127.0.0.1:3118/path')),false);assert.equal(samePdfOrigin(new Request('http://localhost/api',{method:'POST'})),false);
});
test('PDF chunked bodies cannot bypass size limits and IDs reject traversal',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(5));c.enqueue(new Uint8Array(5));c.close();}});await assert.rejects(()=>boundedPdfBody(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'}as RequestInit),8),/body_too_large/);
 assert.equal((await boundedPdfBody(new Request('http://localhost',{method:'POST',body:'1234'}),4)).length,4);assert.equal(validPdfId('../source.pdf'),false);assert.equal(validPdfId('f5a00000-0000-4000-8000-000000000001'),true);
});
test('PDF watermark keeps Unicode identity and uses Brussels date across UTC midnight',()=>{
 assert.equal(pdfWatermark('Zoë D’Hondt','zoe@example.invalid',new Date('2026-10-18T22:30:00Z')),'Zoë D’Hondt · zoe@example.invalid · 19/10/2026');
});
