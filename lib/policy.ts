import {createHash} from "node:crypto";
export const HOURS_72=72*60*60*1000;
export function normalizeEmail(value:string){const e=value.trim().toLowerCase();if(e.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(e)||e.includes(".."))throw Error("Invalid email address");return e;}
export function clientKey(city:string,school:string){const clean=(v:string)=>v.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");return createHash("sha256").update(clean(city)+"|"+clean(school)).digest("hex");}
export function nextDue(sentAt:Date){return new Date(sentAt.getTime()+HOURS_72);}
export function sendingWindow(now:Date){const d=new Date(now.getTime()+330*60000);return d.getUTCDay()>0&&d.getUTCDay()<6&&d.getUTCHours()>=9&&d.getUTCHours()<17;}
export function canSend(l:{status:string;eligible:boolean;sent_count:number;next_send_at:string|null},now:Date){return l.eligible&&["new","following_up"].includes(l.status)&&l.sent_count<4&&!!l.next_send_at&&new Date(l.next_send_at)<=now;}
export function renderTemplate(text:string,lead:{school:string;city:string},sender:string){return text.replaceAll("{{school}}",lead.school).replaceAll("{{city}}",lead.city).replaceAll("{{sender}}",sender);}
export const templates=[
{step:0,subject:"Experiential learning for {{school}}",body:"Hello {{school}} team,\n\nI’m reaching out from Edutrip about curriculum-linked trips and hands-on learning sessions for your students in {{city}}. Our Gold plan includes three educational trips, three SimpLearn sessions, workshops and a teacher toolkit.\n\nWould you be the right person to discuss whether a school subscription could fit your academic calendar? I can share an outline and discuss pricing.\n\n{{sender}}\nEdutrip India\nhttps://www.edutripindia.com"},
{step:1,subject:"Experiential learning for {{school}}",body:"Hello {{school}} team,\n\nFollowing up on my note about Edutrip’s school subscription. We connect classroom topics to real-world visits and hands-on sessions.\n\nWould a short conversation about your upcoming learning calendar be useful? If someone else manages school partnerships, could you point me to them?\n\n{{sender}}\nEdutrip India"},
{step:2,subject:"Experiential learning for {{school}}",body:"Hello {{school}} team,\n\nOne more note in case you are considering experiential learning for your students. Alongside Gold, Edutrip offers Platinum and Diamond packages with additional activities. We can discuss the scope that suits your school.\n\nMay I send a brief plan outline for your review?\n\n{{sender}}\nEdutrip India"},
{step:3,subject:"Experiential learning for {{school}}",body:"Hello {{school}} team,\n\nThis is my final follow-up about Edutrip. I’ll close this outreach if now is not the right time.\n\nIf you would like to explore curriculum-linked trips and hands-on learning sessions later, you can reply to this email and our team will take it from there.\n\nThank you,\n{{sender}}\nEdutrip India"}
];

