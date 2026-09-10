import {randomUUID} from "node:crypto";import {db,rpc,result} from "./db";import {syncReplies,transport} from "./mail";import {renderTemplate,normalizeEmail,sendingWindow} from "./policy";import {unsubscribeURL} from "./unsubscribe";
export async function runWorker(syncOnly=false){const owner=randomUUID();if(!await rpc("ea_lease",{p_owner:owner}))return {status:"busy"};let failure:string|null=null,messageId:string|null=null;
try{const synced=await syncReplies();if(!synced.complete)return {status:"sync_backlog",...synced};
await rpc("ea_housekeeping");
if(syncOnly||process.env.SEND_ENABLED!=="true")return {status:"sync_only",...synced};
if(!sendingWindow(new Date()))return {status:"outside_sending_window",...synced};
const s=await result(db().from("settings").select("*").eq("id",1).single());
if(!s.sending_enabled||!s.templates_approved)return {status:"paused"};
if(!Array.isArray(s.templates)||s.templates.length!==4)throw Error("Four approved sequence templates are required");
const from=normalizeEmail(process.env.TITAN_FROM||"");const replyTo=normalizeEmail(process.env.TITAN_REPLY_TO||"");
const claim=await rpc("ea_claim",{p_owner:owner,p_domain:from.split("@")[1]});if(!claim)return {status:"nothing_due"};
const {lead,message}=claim;messageId=message.id;
const t=s.templates.find((x:any)=>x.step===message.step);if(!t)throw Error("Missing sequence template");
const subject=renderTemplate(t.subject,lead,s.sender_name).replace(/[\r\n]/g," ");
const link=unsubscribeURL(lead.id);const text=renderTemplate(t.body,lead,s.sender_name)+"\n\n"+s.postal_address+"\nIf you prefer no further emails, unsubscribe: "+link;
const previous=await result(db().from("outbound").select("message_id").eq("lead_id",lead.id).eq("state","accepted").order("step"));
const references=(previous||[]).map((x:any)=>x.message_id);
if(!await rpc("ea_begin_send",{p_owner:owner,p_message:message.id,p_subject:subject,p_body:text}))return {status:"cancelled"};
const smtp=transport();try{const info=await smtp.sendMail({from:{name:s.sender_name,address:from},to:lead.email,replyTo,subject:message.step>0?"Re: "+subject:subject,text,messageId:message.message_id,inReplyTo:references.at(-1),references,headers:{"List-Unsubscribe":"<"+link+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}});
if(!info.accepted?.length)throw Error("SMTP did not confirm recipient acceptance");
await rpc("ea_accepted",{p_message:message.id});messageId=null;
return {status:"sent",lead:lead.id,step:message.step};
}finally{smtp.close();}
}catch(e){failure=(e as Error).message;if(messageId)await rpc("ea_uncertain",{p_message:messageId,p_error:"Delivery result requires review. "+failure.slice(0,300)}).catch(()=>{});throw e;
}finally{await rpc("ea_release",{p_owner:owner,p_error:failure?.slice(0,500)||null});}}
