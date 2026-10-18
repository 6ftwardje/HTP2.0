import {pdfTitle} from '@/lib/pdf/policy';
import {pdfPresentation} from '@/lib/pdf/presentation';
export const TOOLBOX_MAX_BYTES=3*1024*1024;
export function toolboxUrl(raw:unknown){
 if(typeof raw!=='string'||raw.length>2000)return null;
 try{const u=new URL(raw.trim()),host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.includes(':')||host.startsWith('[')||/^\d+(\.\d+){3}$/.test(host))return null;return u.href;}catch{return null;}
}
export function toolboxInput(b:Record<string,unknown>){
 const title=pdfTitle(b.title),p=pdfPresentation({description:b.description??'',sortOrder:b.sortOrder??0});
 if(!title||!p||!['link','file'].includes(String(b.kind)))return null;
 const url=b.kind==='link'?toolboxUrl(b.url):null;if(b.kind==='link'&&!url)return null;
 return {title,description:p.description,sort_order:p.sort_order,kind:String(b.kind),url};
}
export function toolboxFilename(name:string){const safe=name.normalize('NFKC').replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/^\.+/,'').trim();return safe.length>0&&safe.length<=180&&/\.(txt|csv|xlsx|zip)$/i.test(safe)?safe:null;}
export function validToolboxFile(name:string,bytes:Uint8Array){
 if(!toolboxFilename(name)||!bytes.length||bytes.length>TOOLBOX_MAX_BYTES||new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))return false;
 if(/\.(xlsx|zip)$/i.test(name))return bytes[0]===0x50&&bytes[1]===0x4b&&((bytes[2]===3&&bytes[3]===4)||(bytes[2]===5&&bytes[3]===6));
 try{return !new TextDecoder('utf-8',{fatal:true}).decode(bytes).includes('\0');}catch{return false;}
}
