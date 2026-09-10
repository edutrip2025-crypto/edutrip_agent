import {createHmac,timingSafeEqual} from "node:crypto";
function secret(){const s=process.env.UNSUBSCRIBE_SECRET;if(!s||s.length<32)throw Error("UNSUBSCRIBE_SECRET must have at least 32 characters");return s;}
export function token(id:string){return createHmac("sha256",secret()).update(id).digest("hex");}
export function validToken(id:string,t:string){if(!/^[a-f0-9-]{36}$/.test(id)||! /^[a-f0-9]{64}$/.test(t))return false;return timingSafeEqual(Buffer.from(t),Buffer.from(token(id)));}
export function unsubscribeURL(id:string){const origin=process.env.APP_URL;if(!origin||!origin.startsWith("https://"))throw Error("APP_URL must be the production HTTPS URL before sending");return origin+"/unsubscribe?id="+id+"&token="+token(id);}

