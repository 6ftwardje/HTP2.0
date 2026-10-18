import{test}from'node:test';import assert from'node:assert/strict';
import{pdfPresentation,updatePdfPublicationError}from'../../lib/pdf/presentation';
test('presentation accepts bounded plain descriptions and preserves omitted existing metadata',()=>{
 assert.deepEqual(pdfPresentation({description:'<b>Een cursus</b>',sortOrder:'4',shelf:'toolbox'}),{description:'Een cursus',sort_order:4,shelf:'toolbox'});
 assert.deepEqual(pdfPresentation({},{description:'Bestaand',sort_order:9,shelf:'toolbox'}),{description:'Bestaand',sort_order:9,shelf:'toolbox'});
 for(const x of [{description:'x'.repeat(601)},{sortOrder:-1},{sortOrder:1.5},{sortOrder:10001},{shelf:'public'}])assert.equal(pdfPresentation(x),null);
});
test('PDF publication does not allow incomplete attachments or alter text/video format rules',()=>{
 assert.equal(updatePdfPublicationError([]),null);
 assert.equal(updatePdfPublicationError([{state:'ready',storage_ready:true,accessible_verified:true}]),null);
 for(const row of [{state:'draft',storage_ready:true,accessible_verified:true},{state:'ready',storage_ready:false,accessible_verified:true},{state:'ready',storage_ready:true,accessible_verified:false},{state:'deleting',storage_ready:true,accessible_verified:true}])assert.match(updatePdfPublicationError([row])??'',/Rond alle PDF/);
});
