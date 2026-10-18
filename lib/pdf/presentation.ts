import sanitizeHtml from 'sanitize-html';
export function pdfPresentation(input:{description?:unknown;sortOrder?:unknown;shelf?:unknown},current={description:'',sort_order:0,shelf:'course'}){
 const raw=input.description??current.description;
 if(typeof raw!=='string'||raw.length>4000)return null;
 const description=sanitizeHtml(raw,{allowedTags:[],allowedAttributes:{}}).replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 const order=input.sortOrder===undefined?current.sort_order:Number(input.sortOrder),shelf=input.shelf??current.shelf;
 if(description.length>600||!Number.isSafeInteger(order)||order<0||order>10000||!['course','toolbox'].includes(String(shelf)))return null;
 return {description,sort_order:order,shelf:String(shelf)};
}
export function updatePdfPublicationError(rows:{state:string;storage_ready:boolean;accessible_verified:boolean}[]){
 return rows.some(x=>x.state!=='ready'||!x.storage_ready||!x.accessible_verified)?'Rond alle PDF-bijlagen af en controleer hun leesversies vóór publicatie.':null;
}
