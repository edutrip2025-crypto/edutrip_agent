export type Status="new"|"following_up"|"replied"|"written_off"|"unsubscribed"|"bounced"|"needs_review";
export type Lead={id:string;school:string;city:string;locality:string;email:string;phone:string;source_url:string;status:Status;sent_count:number;next_send_at:string|null;last_sent_at:string|null;replied_at:string|null;eligible:boolean;permission_note:string;created_at:string};
export type Template={step:number;subject:string;body:string};
export type Settings={id:number;sending_enabled:boolean;daily_limit:number;min_gap_minutes:number;templates_approved:boolean;sender_name:string;postal_address:string;templates:Template[];last_sync_at:string|null;last_run_at:string|null;last_error:string|null};
export type Dashboard={demo:boolean;leads:Lead[];messages:any[];replies:any[];imports:any[];settings:Settings;stats:Record<string,number>;setup:Record<string,boolean>};

