import {ImapFlow} from "imapflow";
import {createHash} from "node:crypto";
import {simpleParser} from "mailparser";
import nodemailer from "nodemailer";
import {db,rpc,result} from "./db";
function required(name:string){const value=process.env[name];if(!value)throw Error("Missing "+name);return value;}
export function mailConfig(){return {host:process.env.TITAN_IMAP_HOST||"imap.titan.email",port:Number(process.env.TITAN_IMAP_PORT||993),secure:true,logger:false as const,connectionTimeout:15000,socketTimeout:30000,auth:{user:required("TITAN_REPLY_USER"),pass:required("TITAN_REPLY_PASSWORD")}};}
export function classify(from:string,subject:string,text:string,auto:string){if(/mailer-daemon|postmaster/i.test(from)&&/undeliver|failure|delivery|returned/i.test(subject))return "bounce";if(/^\s*(unsubscribe|remove me|stop emailing|do not contact)/i.test(text))return "unsubscribe";if(auto&&auto!=="no")return "automatic";return "reply";}
export async function syncReplies(){const base=mailConfig(),self=[process.env.TITAN_SMTP_USER,process.env.TITAN_FROM,process.env.TITAN_REPLY_TO,process.env.TITAN_REPLY_USER].filter(Boolean).map(x=>x!.toLowerCase());
const configs=[{...base,folders:required("TITAN_REPLY_FOLDERS").split(",")}];
if(process.env.TITAN_SMTP_USER!==process.env.TITAN_REPLY_USER)configs.push({...base,auth:{user:required("TITAN_SMTP_USER"),pass:required("TITAN_SMTP_PASSWORD")},folders:(process.env.TITAN_SENDER_FOLDERS||"INBOX").split(",")});
let complete=true,processed=0;const deadline=Date.now()+150000;
for(const config of configs){const client=new ImapFlow(config);try{await client.connect();for(const folder of config.folders.map(x=>x.trim()).filter(Boolean)){
if(Date.now()>deadline){complete=false;break;}
const lock=await client.getMailboxLock(folder);try{const box=client.mailbox;if(!box)throw Error("Mailbox did not open");const key=config.auth.user.toLowerCase()+":"+folder;const validity=String(box.uidValidity);
const cursor=await result(db().from("mail_cursors").select("*").eq("mailbox",key).maybeSingle());let last=cursor?.uid_validity===validity?Number(cursor.last_uid):0;const end=Number(box.uidNext)-1;
if(end>last){const uids=await client.search({uid:(last+1)+":"+end},{uid:true});const pending=Array.isArray(uids)?uids:[];if(pending.length>150)complete=false;
for(const uid of pending.slice(0,150)){if(Date.now()>deadline){complete=false;break;}const msg=await client.fetchOne(String(uid),{source:true,size:true},{uid:true});if(!msg)throw Error("Message disappeared during sync; retry without sending");if((msg.size||0)>2*1024*1024)throw Error("Large inbound message requires review in "+folder+" UID "+uid);
const parsed=await simpleParser(msg.source!,{skipHtmlToText:true,skipImageLinks:true,skipTextToHtml:true});const from=(parsed.from?.value[0]?.address||"").toLowerCase();const refs=[parsed.inReplyTo,...(Array.isArray(parsed.references)?parsed.references:[parsed.references])].filter(Boolean) as string[];const text=parsed.text||"";const attachments=parsed.attachments.filter(a=>/delivery-status|rfc822/i.test(a.contentType)).map(a=>a.content.toString("utf8").slice(0,20000)).join("\n");
const kind=classify(from,parsed.subject||"",text,String(parsed.headers.get("auto-submitted")||""));const recipient=(text+"\n"+attachments).match(/(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([^\s<>]+)/i)?.[1]||"";
if(!self.includes(from))await rpc("ea_inbound",{p_key:parsed.messageId?"mid:"+createHash("sha256").update(parsed.messageId).digest("hex"):key+":"+validity+":"+uid,p_from:from,p_subject:(parsed.subject||"").slice(0,500),p_refs:refs,p_kind:kind,p_mid:parsed.messageId||"",p_excerpt:text.slice(0,1500),p_recipient:recipient});
last=uid;await result(db().from("mail_cursors").upsert({mailbox:key,uid_validity:validity,last_uid:last}));processed++;}
}else await result(db().from("mail_cursors").upsert({mailbox:key,uid_validity:validity,last_uid:end}));
}finally{lock.release();}}
}finally{await client.logout().catch(()=>client.close());}}
if(complete)await result(db().from("settings").update({last_sync_at:new Date().toISOString()}).eq("id",1));
return {complete,processed};}
export function transport(){const port=Number(process.env.TITAN_SMTP_PORT||465);if(![465,587].includes(port))throw Error("Use secure Titan SMTP port 465 or 587");return nodemailer.createTransport({host:process.env.TITAN_SMTP_HOST||"smtp.titan.email",port,secure:port===465,requireTLS:port===587,auth:{user:required("TITAN_SMTP_USER"),pass:required("TITAN_SMTP_PASSWORD")},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,disableFileAccess:true,disableUrlAccess:true});}
export async function sentCopyExists(messageId:string){const client=new ImapFlow({...mailConfig(),auth:{user:required("TITAN_SMTP_USER"),pass:required("TITAN_SMTP_PASSWORD")}});try{await client.connect();const lock=await client.getMailboxLock(process.env.TITAN_SENT_FOLDER||"Sent");try{const found=await client.search({header:{"Message-ID":messageId}},{uid:true});return Array.isArray(found)&&found.length>0;}finally{lock.release();}}finally{await client.logout().catch(()=>client.close());}}
