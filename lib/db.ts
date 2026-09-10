import {createClient} from "@supabase/supabase-js";
export function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error("Supabase is not configured");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function rpc(name:string,args:Record<string,unknown>={}){const {data,error}=await db().rpc(name,args);if(error)throw Error(error.message);return data;}
export async function requireAdmin(req:Request){const token=req.headers.get("authorization")?.replace(/^Bearer /,"");if(!token)throw Error("Unauthorized");const {data,error}=await db().auth.getUser(token);const allowed=(process.env.ADMIN_EMAILS||"").toLowerCase().split(",").map(x=>x.trim());if(error||!data.user?.email||!allowed.includes(data.user.email.toLowerCase()))throw Error("Unauthorized");return data.user;}
export async function result<T>(q:PromiseLike<{data:T;error:any}>):Promise<T>{const {data,error}=await q;if(error)throw Error(error.message);return data;}

