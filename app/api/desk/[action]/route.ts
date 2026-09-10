import {db,rpc,result,requireAdmin} from "@/lib/db";import {demo} from "@/lib/demo";import {parseWorkbook} from "@/lib/import";import {templates} from "@/lib/policy";import {runWorker} from "@/lib/worker";import {sentCopyExists} from "@/lib/mail";
export const runtime="nodejs";export const maxDuration=300;export const dynamic="force-dynamic";
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{"Cache-Control":"no-store"}});
async function action(req:Request,ctx:{params:Promise<{action:string}>}){const {action}=await ctx.params;
try{
if(action==="dashboard"&&req.method==="GET"&&!process.env.NEXT_PUBLIC_SUPABASE_URL)return json(demo());
await requireAdmin(req);
if(action==="dashboard"&&req.method==="GET"){
const [leads,messages,replies,imports,s,stats]=await Promise.all([
result(db().from("leads").select("*").order("created_at",{ascending:false}).limit(1000)),
result(db().from("outbound").select("*").order("created_at",{ascending:false}).limit(100)),
result(db().from("inbound").select("*").order("received_at",{ascending:false}).limit(100)),
result(db().from("imports").select("*").order("created_at",{ascending:false}).limit(20)),
result(db().from("settings").select("*").eq("id",1).single()),rpc("ea_stats")]);
return json({demo:false,leads,messages,replies,imports,stats,settings:{...s,templates:s.templates?.length?s.templates:templates,lease_owner:undefined},setup:{database:true,mail:!!(process.env.TITAN_SMTP_USER&&process.env.TITAN_SMTP_PASSWORD&&process.env.TITAN_REPLY_USER&&process.env.TITAN_REPLY_PASSWORD&&process.env.TITAN_REPLY_TO&&process.env.TITAN_FROM),live:process.env.SEND_ENABLED==="true"}});
}
if(req.method!=="POST")return json({error:"Not found"},404);
if(action==="import"){
if(Number(req.headers.get("content-length")||0)>6*1024*1024)throw Error("File too large");
const form=await req.formData();const file=form.get("file");if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".xlsx"))throw Error("Upload an .xlsx file");
const parsed=await parseWorkbook(Buffer.from(await file.arrayBuffer()));return json(await rpc("ea_import",{p_rows:parsed.rows,p_filename:file.name.slice(0,250),p_errors:parsed.errors}));
}
const body=await req.json();
if(action==="qualify"){if(!Array.isArray(body.ids)||body.ids.length>200||!body.ids.length||typeof body.note!=="string"||body.note.trim().length<10)throw Error("Select leads and explain the permission or permitted contact basis (at least 10 characters)");
await result(db().from("leads").update({eligible:true,permission_note:body.note.slice(0,1000)}).in("id",body.ids).eq("status","new"));return json({ok:true});}
if(action==="stop"){await rpc("ea_suppress",{p_lead:body.id,p_status:body.status||"unsubscribed"});return json({ok:true});}
if(action==="settings"){
const ts=body.templates;if(!Array.isArray(ts)||ts.length!==4||ts.some((t:any,i:number)=>t.step!==i||typeof t.subject!=="string"||!t.subject.trim()||t.subject.length>180||/[\r\n]/.test(t.subject)||typeof t.body!=="string"||t.body.length<20||t.body.length>5000||/\{\{(?!(school|city|sender)\}\})/.test(t.body+t.subject)))throw Error("Provide four valid templates. Available fields: school, city, sender.");
if(!Number.isInteger(body.daily_limit)||body.daily_limit<1||body.daily_limit>50)throw Error("Daily cap must be 1–50");if(!Number.isInteger(body.min_gap_minutes)||body.min_gap_minutes<30||body.min_gap_minutes>240)throw Error("Send interval must be 30–240 minutes");if(typeof body.sender_name!=="string"||!body.sender_name.trim()||/[\r\n]/.test(body.sender_name))throw Error("Sender name required");
await result(db().from("settings").update({templates:ts,templates_approved:true,sending_enabled:false,daily_limit:body.daily_limit,min_gap_minutes:body.min_gap_minutes,sender_name:body.sender_name.slice(0,100),postal_address:String(body.postal_address||"").slice(0,400)}).eq("id",1));return json({ok:true,message:"Templates and schedule saved. Sending paused; resume after review."});}
if(action==="toggle"){if(body.enabled===true){const s=await result(db().from("settings").select("*").eq("id",1).single());if(process.env.SEND_ENABLED!=="true"||!s.templates_approved||!s.postal_address||!process.env.TITAN_FROM||!process.env.TITAN_REPLY_TO||!process.env.APP_URL?.startsWith("https://")||!process.env.UNSUBSCRIBE_SECRET||process.env.UNSUBSCRIBE_SECRET.length<32)throw Error("Complete deployment and sender setup before enabling sending");}
await result(db().from("settings").update({sending_enabled:body.enabled===true}).eq("id",1));return json({ok:true});}
if(action==="sync")return json(await runWorker(true));
if(action==="reconcile"){const m=await result(db().from("outbound").select("*").eq("id",body.id).single());if(!["uncertain","sending"].includes(m.state))throw Error("This message does not need reconciliation");if(!await sentCopyExists(m.message_id))throw Error("No matching Titan Sent copy. Leave paused and investigate; no retry was sent.");await rpc("ea_accepted",{p_message:m.id});return json({ok:true});}
return json({error:"Not found"},404);
}catch(e){const message=(e as Error).message;return json({error:message==="Unauthorized"?"Unauthorized":message},message==="Unauthorized"?401:400);}
}
export const GET=action;export const POST=action;

