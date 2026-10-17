import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanTakeaway, editorialContext, hasEditorialSentence, parseTakeaways } from '../../lib/market-editorial';

test('F3b optional context keeps short values as labels and full sentences as sections without mutating source content',()=>{
 for(const short of ['', 'CPI Rentebesluit', 'Rente om 14.30 uur', 'BTC vs. EUR', 'Marktupdate met bijv.']) assert.equal(hasEditorialSentence(short),false,short);
 for(const sentence of ['De markt wacht op nieuwe informatie.', 'Wat betekent deze beweging voor goud?', 'De koers bleef boven de steunzone!']) assert.equal(hasEditorialSentence(sentence),true,sentence);
 assert.deepEqual(editorialContext('CPI Rentebesluit','CPI Rentebesluit'),{summary:null,event:null,labels:['CPI Rentebesluit']});
 assert.deepEqual(editorialContext('De markt wacht op nieuwe informatie.','Rente om 14.30 uur'),{summary:'De markt wacht op nieuwe informatie.',event:null,labels:['Rente om 14.30 uur']});
 assert.deepEqual(editorialContext(null,'  '),{summary:null,event:null,labels:[]});
});

test('F3b list-prefix normalization preserves financial decimals, dates, years and internal numbering',()=>{
 assert.deepEqual(parseTakeaways('1. Eerste inzicht.\n2) Tweede inzicht.\n\n1.5% is het niveau.\n2026. blijft historische context.\nBTC 1) blijft staan.'),['Eerste inzicht.','Tweede inzicht.','1.5% is het niveau.','2026. blijft historische context.','BTC 1) blijft staan.']);
 for(const value of ['1.5', '2)zonder spatie', '€ 1.000', '2026. Jaarcontext'])assert.equal(cleanTakeaway(value),value);
 assert.deepEqual(parseTakeaways(null),[]);
});
