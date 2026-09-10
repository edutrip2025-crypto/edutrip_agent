-- Run once in the NEW Edutrip Agent Supabase project SQL editor.
-- Every table is private to the server. Browser users never receive service-role credentials.
create table public.settings (
 id integer primary key check(id=1), sending_enabled boolean not null default false,
 daily_limit integer not null default 5 check(daily_limit between 1 and 50),
 min_gap_minutes integer not null default 30 check(min_gap_minutes between 15 and 240),
 templates_approved boolean not null default false, sender_name text not null default 'Edutrip team',
 postal_address text not null default '', templates jsonb not null default '[]',
 last_sync_at timestamptz, last_run_at timestamptz, last_error text,
 lease_owner uuid, lease_until timestamptz, last_attempt_at timestamptz
);
insert into public.settings(id) values(1);
create table public.leads (
 id uuid primary key default gen_random_uuid(), client_key text not null unique,
 school text not null, city text not null, locality text not null default '',
 email text not null unique check(email=lower(trim(email))), phone text not null default '', source_url text not null default '',
 status text not null default 'new' check(status in ('new','following_up','replied','written_off','unsubscribed','bounced','needs_review')),
 eligible boolean not null default false, permission_note text not null default '',
 sent_count integer not null default 0 check(sent_count between 0 and 4),
 next_send_at timestamptz default now(), last_sent_at timestamptz, replied_at timestamptz,
 created_at timestamptz not null default now()
);
create index leads_due on public.leads(next_send_at) where eligible and status in ('new','following_up');
create table public.outbound (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id),
 step integer not null check(step between 0 and 3), message_id text not null unique,
 state text not null check(state in ('reserved','sending','accepted','uncertain','cancelled')),
 subject text not null default '', body text not null default '', error text,
 created_at timestamptz not null default now(), sent_at timestamptz,
 unique(lead_id,step)
);
create index outbound_recent on public.outbound(created_at desc);
create table public.inbound (
 id uuid primary key default gen_random_uuid(), event_key text not null unique,
 lead_id uuid references public.leads(id), from_email text not null, subject text not null,
 kind text not null check(kind in ('reply','automatic','bounce','unsubscribe','unmatched')),
 message_id text, excerpt text not null default '', received_at timestamptz not null default now()
);
create index inbound_lead on public.inbound(lead_id);
create table public.mail_cursors (
 mailbox text primary key, uid_validity text not null, last_uid bigint not null default 0
);
create table public.imports (
 id uuid primary key default gen_random_uuid(), filename text not null,
 inserted integer not null, duplicates integer not null, rejected integer not null,
 issues jsonb not null default '[]', created_at timestamptz not null default now()
);
alter table public.settings enable row level security;
alter table public.leads enable row level security;
alter table public.outbound enable row level security;
alter table public.inbound enable row level security;
alter table public.mail_cursors enable row level security;
alter table public.imports enable row level security;
revoke all on public.settings,public.leads,public.outbound,public.inbound,public.mail_cursors,public.imports from anon,authenticated;
grant all on public.settings,public.leads,public.outbound,public.inbound,public.mail_cursors,public.imports to service_role;

create function public.ea_import(p_rows jsonb,p_filename text,p_errors jsonb default '[]') returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare r jsonb; existing leads; n integer:=0; d integer:=0; bad integer:=jsonb_array_length(p_errors); issues jsonb:=p_errors;
begin
 perform pg_advisory_xact_lock(784122);
 for r in select * from jsonb_array_elements(p_rows) loop
   select * into existing from leads where email=r->>'email' or client_key=r->>'client_key' limit 1;
   if found then
     if existing.email=r->>'email' and existing.client_key=r->>'client_key' then
       update leads set locality=r->>'locality',phone=r->>'phone',source_url=r->>'source_url' where id=existing.id;
       d:=d+1;
     else
       bad:=bad+1;issues:=issues||jsonb_build_array(jsonb_build_object('email',r->>'email','reason','Existing client or email conflicts. History preserved; review address manually.'));
     end if;
   else
     insert into leads(client_key,school,city,locality,email,phone,source_url) values(r->>'client_key',r->>'school',r->>'city',r->>'locality',r->>'email',r->>'phone',r->>'source_url');
     n:=n+1;
   end if;
 end loop;
 insert into imports(filename,inserted,duplicates,rejected,issues) values(p_filename,n,d,bad,issues);
 return jsonb_build_object('inserted',n,'duplicates',d,'rejected',bad,'issues',issues);
end $$;

create function public.ea_lease(p_owner uuid) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update settings set lease_owner=p_owner,lease_until=now()+interval '5 minutes',last_run_at=now()
 where id=1 and (lease_until is null or lease_until<now());
 return found;
end $$;
create function public.ea_release(p_owner uuid,p_error text default null) returns void language sql security invoker set search_path=public,pg_temp as $$
 update settings set lease_until=null,lease_owner=null,last_error=p_error where id=1 and lease_owner=p_owner;
$$;

create function public.ea_claim(p_owner uuid,p_domain text) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s settings; l leads; m outbound; localnow timestamp:=now() at time zone 'Asia/Kolkata'; used integer;
begin
 select * into s from settings where id=1 for update;
 if s.lease_owner is distinct from p_owner or s.lease_until<now() or not s.sending_enabled or not s.templates_approved or s.postal_address='' then return null;end if;
 if s.last_sync_at is null or s.last_sync_at<now()-interval '2 minutes' then return null;end if;
 if extract(isodow from localnow)>5 or extract(hour from localnow)<10 or extract(hour from localnow)>=16 then return null;end if;
 if s.last_attempt_at>now()-make_interval(mins=>s.min_gap_minutes) then return null;end if;
 select count(*) into used from outbound where state in ('reserved','sending','accepted','uncertain') and created_at>=date_trunc('day',localnow) at time zone 'Asia/Kolkata';
 if used>=s.daily_limit then return null;end if;
 update outbound set state='uncertain',error='Worker ended before acceptance was recorded. Reconcile with Titan Sent.' where state in ('reserved','sending') and created_at<now()-interval '10 minutes';
 update leads set status='needs_review',next_send_at=null where id in(select lead_id from outbound where state='uncertain') and status in ('new','following_up');
 update leads set status='written_off',next_send_at=null where status='following_up' and sent_count=4 and next_send_at<=now();
 select * into l from leads where eligible and status in ('new','following_up') and sent_count<4 and next_send_at<=now()
 and not exists(select 1 from outbound where lead_id=leads.id and step=leads.sent_count)
 order by (sent_count>0) desc,next_send_at,created_at for update skip locked limit 1;
 if not found then return null;end if;
 insert into outbound(lead_id,step,message_id,state) values(l.id,l.sent_count,'<edutrip.'||l.id||'.'||l.sent_count||'@'||p_domain||'>','reserved') returning * into m;
 update settings set last_attempt_at=now() where id=1;
 return jsonb_build_object('lead',to_jsonb(l),'message',to_jsonb(m));
end $$;

create function public.ea_begin_send(p_owner uuid,p_message uuid,p_subject text,p_body text) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare s settings; m outbound; l leads;
begin
 select * into s from settings where id=1 for update;
 select * into m from outbound where id=p_message for update;
 select * into l from leads where id=m.lead_id for update;
 if s.lease_owner is distinct from p_owner or s.lease_until<now() or not s.sending_enabled or s.last_sync_at<now()-interval '2 minutes'
 or not l.eligible or l.status not in ('new','following_up') or l.sent_count<>m.step or m.state<>'reserved' then
   update outbound set state='cancelled' where id=p_message and state='reserved';return false;
 end if;
 update outbound set state='sending',subject=p_subject,body=p_body where id=p_message;
 return true;
end $$;
create function public.ea_accepted(p_message uuid) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare m outbound; t timestamptz:=now();
begin
 select * into m from outbound where id=p_message for update;
 if not found or m.state='accepted' then return;end if;
 if m.state not in ('sending','uncertain') then raise exception 'Message cannot be accepted in this state';end if;
 update outbound set state='accepted',sent_at=t,error=null where id=m.id;
 update leads set sent_count=greatest(sent_count,m.step+1),last_sent_at=t,
 status=case when status in ('new','following_up','needs_review') then 'following_up' else status end,
 next_send_at=case when status in ('new','following_up','needs_review') then t+interval '72 hours' else null end where id=m.lead_id;
end $$;
create function public.ea_uncertain(p_message uuid,p_error text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update outbound set state='uncertain',error=p_error where id=p_message and state in ('sending','reserved');
 update leads set status='needs_review',next_send_at=null where id=(select lead_id from outbound where id=p_message) and status in ('new','following_up');
end $$;
create function public.ea_inbound(p_key text,p_from text,p_subject text,p_refs text[],p_kind text,p_mid text,p_excerpt text,p_recipient text default '') returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare lid uuid; event_id uuid; k text:=p_kind;
begin
 if exists(select 1 from inbound where event_key=p_key) then return null;end if;
 select lead_id into lid from outbound where message_id=any(p_refs) limit 1;
 if lid is null then select id into lid from leads where email=lower(p_from) and exists(select 1 from outbound where lead_id=leads.id and state in ('sending','accepted','uncertain')) limit 1;end if;
 if lid is null and p_kind='bounce' then select id into lid from leads where email=lower(p_recipient) and exists(select 1 from outbound where lead_id=leads.id) limit 1;end if;
 if lid is null then k:='unmatched';end if;
 insert into inbound(event_key,lead_id,from_email,subject,kind,message_id,excerpt) values(p_key,lid,p_from,p_subject,k,p_mid,p_excerpt) on conflict(event_key) do nothing returning id into event_id;
 if event_id is not null and lid is not null then
   if k='bounce' then update settings set sending_enabled=false,last_error='A delivery failure was received. Review the address and sender health before resuming.' where id=1;end if;
   update leads set status=case when status in ('unsubscribed','bounced') then status when k='bounce' then 'bounced' when k='unsubscribe' then 'unsubscribed' else 'replied' end,
   replied_at=case when k in ('reply','automatic','unsubscribe') then coalesce(replied_at,now()) else replied_at end,
   eligible=false,next_send_at=null where id=lid;
 end if;
 return event_id;
end $$;
create function public.ea_suppress(p_lead uuid,p_status text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_status not in ('unsubscribed','bounced','replied') then raise exception 'Invalid stop status';end if;
 update leads set status=p_status,eligible=false,next_send_at=null,replied_at=case when p_status='replied' then coalesce(replied_at,now()) else replied_at end where id=p_lead;
end $$;
create function public.ea_housekeeping() returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update outbound set state='uncertain',error='Worker stopped before delivery could be confirmed.' where state in ('reserved','sending') and created_at<now()-interval '10 minutes';
 update leads set status='needs_review',next_send_at=null where id in(select lead_id from outbound where state='uncertain') and status in ('new','following_up');
 update leads set status='written_off',next_send_at=null where status='following_up' and sent_count=4 and next_send_at<=now();
end $$;
create function public.ea_stats() returns jsonb language sql security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'leads',(select count(*) from leads),
 'sent',(select count(*) from outbound where state='accepted'),
 'replies',(select count(*) from inbound where kind='reply'),
 'replied',(select count(*) from leads where replied_at is not null),
 'following_up',(select count(*) from leads where status='following_up'),
 'written_off',(select count(*) from leads where status='written_off'),
 'review',(select count(*) from leads where (status='new' and not eligible) or status='needs_review'),
 'suppressed',(select count(*) from leads where status in ('unsubscribed','bounced')),
 'sent_today',(select count(*) from outbound where state='accepted' and sent_at>=(date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')));
$$;
-- Default function EXECUTE privilege is PUBLIC; explicitly restrict every agent function.
do $$ declare f record;begin
 for f in select oid::regprocedure as name from pg_proc where pronamespace='public'::regnamespace and proname like 'ea_%' loop
 execute 'revoke all on function '||f.name||' from public, anon, authenticated';
 execute 'grant execute on function '||f.name||' to service_role';
 end loop;
end $$;
