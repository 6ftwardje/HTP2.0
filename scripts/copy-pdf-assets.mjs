/** Pin the worker/fonts to the installed renderer version; no runtime CDN. */
import {mkdir,copyFile,cp,writeFile,readFile} from 'node:fs/promises';
const version=JSON.parse(await readFile('node_modules/pdfjs-dist/package.json','utf8')).version;
const destination='public/pdf-assets';await mkdir(destination,{recursive:true});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',destination+'/pdf.worker.mjs');
await copyFile('node_modules/pdfjs-dist/LICENSE',destination+'/LICENSE');
await cp('node_modules/pdfjs-dist/standard_fonts',destination+'/standard_fonts',{recursive:true});
await cp('node_modules/pdfjs-dist/wasm',destination+'/wasm',{recursive:true});
await writeFile(destination+'/version.json',JSON.stringify({version}));
