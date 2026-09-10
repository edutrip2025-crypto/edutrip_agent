import JSZip from "jszip";
import {XMLParser} from "fast-xml-parser";
import {posix} from "node:path";
import {Readable} from "node:stream";
import {normalizeEmail,clientKey} from "./policy";
export type Imported={school:string;city:string;locality:string;email:string;phone:string;source_url:string;client_key:string};
const array=(v:any):any[]=>v==null?[]:Array.isArray(v)?v:[v];
const text=(v:any):string=>v==null?"":typeof v==="object"?text(v["#text"]):String(v);
const rich=(v:any):string=>v?.t!==undefined?text(v.t):array(v?.r).map(r=>text(r.t)).join("");
export async function parseWorkbook(bytes:Buffer){
if(bytes.length>4*1024*1024)throw Error("Maximum file size is 4 MB");
const zip=await JSZip.loadAsync(bytes);if(Object.keys(zip.files).length>500)throw Error("Workbook has too many entries");
let expanded=0;
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,trimValues:false});
async function xml(path:string){const entry=zip.file(path);if(!entry)throw Error("Missing workbook part: "+path);const stream=entry.nodeStream("nodebuffer") as Readable;const chunks:Buffer[]=[];
await new Promise<void>((resolve,reject)=>{stream.on('data',(chunk:Buffer)=>{expanded+=chunk.length;if(expanded>30*1024*1024){stream.pause();stream.destroy();reject(Error('Workbook expands beyond 30 MB'));return;}chunks.push(chunk);});stream.on('end',resolve);stream.on('error',reject);});
const s=Buffer.concat(chunks).toString("utf8");if(/<!DOCTYPE|<!ENTITY/i.test(s))throw Error("XML entity definitions are not accepted");return parser.parse(s);}
const workbook=await xml("xl/workbook.xml"),rels=await xml("xl/_rels/workbook.xml.rels");
const shared=zip.file("xl/sharedStrings.xml")?array((await xml("xl/sharedStrings.xml")).sst?.si).map(rich):[];
const sheets=array(workbook.workbook?.sheets?.sheet);if(sheets.length>20)throw Error("Maximum 20 worksheets");
let chosen:any[]|null=null,headers:string[]=[],headerRow=0;
for(const sheet of sheets){const rel=array(rels.Relationships?.Relationship).find(r=>r["@_Id"]===sheet["@_id"]);if(!rel||rel["@_TargetMode"]==="External")continue;const target=rel["@_Target"]||"";const path=posix.normalize(target.startsWith("/")?target.slice(1):posix.join("xl",target));if(!path.startsWith("xl/"))throw Error("Invalid worksheet path");
const rows=array((await xml(path)).worksheet?.sheetData?.row);if(rows.length>2020)throw Error("Maximum 2,000 data rows plus headers");
const parsed=rows.map(r=>({number:Number(r["@_r"]),cells:array(r.c).map(c=>{const address=c["@_r"]||"";const col=address.match(/^[A-Z]+/)?.[0];if(!col)return null;let n=0;for(const ch of col)n=n*26+ch.charCodeAt(0)-64;if(n>100)throw Error("Maximum 100 columns");const value=c["@_t"]==="s"?shared[Number(text(c.v))]||"":c["@_t"]==="inlineStr"?rich(c.is):text(c.v);return {col:n-1,value,formula:Object.hasOwn(c,"f")};})}));
for(const row of parsed.filter(r=>r.number<=20)){const h:string[]=[];for(const c of row.cells)if(c)h[c.col]=c.value.trim().toLowerCase();if(h.includes("email")&&h.includes("school")&&h.includes("city")){if(chosen)throw Error("Multiple lead tables found; upload one lead sheet");chosen=parsed;headers=h;headerRow=row.number;break;}}
}
if(!chosen)throw Error("Required headers: School, City, Email. Optional: Locality, Phone, Source URL.");
const rows:Imported[]=[],errors:{row:number;reason:string}[]=[];const seen=new Set<string>();
for(const r of chosen.filter(r=>r.number>headerRow)){try{const value=(h:string)=>{const c=r.cells.find((c:any)=>c?.col===headers.indexOf(h));if(c?.formula)throw Error("Formula cells are not accepted in lead data");return c?.value.trim()||"";};
if(!value("email")&&!value("school"))continue;
const school=value("school"),city=value("city");if(!school||!city||school.length>250||city.length>100)throw Error("School and city required (maximum 250/100 characters)");
const email=normalizeEmail(value("email"));if(seen.has(email))throw Error("Duplicate email within this file");seen.add(email);const source=value("source url");if(source&&!/^https?:\/\//i.test(source))throw Error("Source URL must start with http(s)");
rows.push({school,city,email,locality:value("locality").slice(0,250),phone:value("phone").slice(0,50),source_url:source.slice(0,2000),client_key:clientKey(city,school)});
}catch(e){errors.push({row:r.number,reason:(e as Error).message});}}
if(rows.length>2000)throw Error("Maximum 2,000 rows per import");if(!rows.length)throw Error("No valid lead rows found");return {rows,errors};
}
