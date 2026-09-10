# Edutrip Agent

A separate school outreach application: Next.js dashboard, private Supabase database, Titan SMTP/IMAP, and a scheduled worker.

## Run the preview
```powershell
npm ci
npm run dev
```
Without Supabase environment variables the dashboard shows explicitly fictional demo data. Demo controls never send email or persist lead changes.

## Connect your new Supabase project
1. Create a **new** Supabase project. Run [db/schema.sql](db/schema.sql) once in its SQL editor. This is a bootstrap schema, not an incremental migration.
2. In Authentication, create your team user with email/password. Disable public signups. Add the exact email to `ADMIN_EMAILS`.
3. Copy `.env.example` to `.env.local`. Set the new project's URL, publishable key and server-only service-role key. Never reuse the main Edutrip database.
4. Sign in. Import `data/Edutrip_School_Leads.xlsx`. The file is stored locally and excluded from Git.
5. Review contact eligibility. Select new leads and document permission or another contact basis permitted by Titan and applicable rules. Website publication alone is not consent.
6. Review all four templates under Sequence. Set the real sender name and business postal address. Save & approve.

Only the two `NEXT_PUBLIC_` variables are sent to browsers. Supabase Auth verifies the user on every private API request and the server checks the admin email allowlist. All six database tables have RLS enabled and direct access revoked from anon/authenticated roles. Agent functions use SECURITY INVOKER and are executable only by service_role.

## Connect Titan
Set the sender mailbox, password/application password, From address, provisioned reply alias, and monitored reply mailbox in server environment variables. Turn on Titan third-party client access.

Typical non-EU hosts are `smtp.titan.email:465` (TLS) and `imap.titan.email:993` (TLS). Port 587 uses mandatory STARTTLS. Confirm reseller/region-specific settings in Titan.

Use a dedicated outreach sender mailbox. Set `TITAN_REPLY_TO` to an alias you have actually provisioned and forward it into `TITAN_REPLY_USER`. The application does not assume catch-all or plus-addressing support. Reply-To aliases are not separate IMAP accounts; authenticate the destination mailbox.

For this deployment, send from `founders@edutripindia.com`, use `schools@edutripindia.com` as Reply-To, authenticate IMAP as `founders@edutripindia.com`, and monitor `INBOX` plus `Agent email replies`.

Set the exact folder names in `TITAN_REPLY_FOLDERS` and `TITAN_SENDER_FOLDERS`, including any Junk/Spam or filtered folders. The sender mailbox is also checked for bounces/direct replies if it differs from the reply mailbox. Keep the configured folders intact.

## Separate Vercel deployment
Create a new Vercel project for this repository. Never link this folder to the existing Edutrip application.

- Framework: Next.js. Install: `npm ci`. Build: `npm run build`. Node: 24.
- Set all production variables from `.env.example`.
- Set `APP_URL` to the permanent HTTPS production URL. Use at least 32 random characters each for `CRON_SECRET` and `UNSUBSCRIBE_SECRET`.
- The current Vercel project is on Hobby, so `vercel.json` deliberately has no cron. The included GitHub Actions workflow calls `/api/cron` every 15 minutes after repository secret `CRON_SECRET` is configured. Never enable a second scheduler.
- A deployed preview remains a demo until Supabase is connected. Only the production deployment should ever receive `SEND_ENABLED=true`.
- Test Titan sending to your own controlled address and reply through the configured alias before enabling real leads. Verify SPF/DKIM/DMARC using the received headers.
- Use Check replies and confirm the sync time updates. After all checks, set `SEND_ENABLED=true` and enable sending in Sequence.

Vercel cron authorization uses `Authorization: Bearer <CRON_SECRET>`. Unauthenticated cron requests return 401. Vercel preview URLs should keep `SEND_ENABLED=false`. A function instance sends at most one email and is capped at 300 seconds.

The scheduler polls Titan even outside sending hours so replies can stop future messages. Supabase Realtime is not a mailbox listener; the dashboard refreshes its private server API every 30 seconds.

## Sequence and dashboard semantics
- One introduction, then at most three follow-ups.
- At least 72 hours after the prior SMTP acceptance. Weekday 10 am–4 pm IST sending window can extend the interval.
- Initial cap: 5 total emails/day, including follow-ups. Minimum gap: 30 minutes. Eligible follow-ups are prioritized.
- After the fourth email, wait 72 hours; write off only after a successful reply scan. No fifth email is scheduled.
- Any matched reply, including an automatic response, stops the sequence. A late reply moves a written-off lead to Replied. Reply manually in Titan.
- Emails sent counts SMTP-accepted messages; this is **not** proof of inbox delivery.
- Replies received counts matched human messages, deduplicated by Message-ID. Replied-school counts also include manually stopped/automatic responses.
- Following up includes the final 72-hour response window. Written off means that window elapsed without a detected reply.
- Reply excerpts and unmatched messages appear in the private inbox. Open Titan for the full message or attachments.
- Opt-outs and matched bounces suppress the lead. A matched bounce also pauses the campaign for review.

## Import behavior
Required headers: `School`, `City`, `Email`. Optional: `Locality`, `Phone`, `Source URL`. One lead table in the first 20 rows of a worksheet, up to 2,000 data rows and a 4 MB file. Both standard and namespace-prefixed XLSX are supported. Formula cells in imported fields are rejected. Expanded XML is bounded to 30 MB; external entities are rejected.

Email is trimmed/lowercased, but Gmail dots and plus-tags are not silently collapsed. A normalized city+school identity provides a second unique key. Re-imported records update only locality/phone/source. They never reset eligibility, status or sequence history. A changed email for an existing school, or a changed identity for an existing email, is rejected for manual review. School-name aliases/fuzzy duplicates still need human review. Distinct campuses should have explicit campus names in School.

The database is the source of truth. Deleting a row from Excel does not delete its history or stop it. Use Stop in the dashboard. Imported Outreach status and Contact permission columns are intentionally not trusted to restart sequences.

## Failure handling
A database lease prevents overlapping worker runs. A unique lead+step constraint prevents duplicate introductions and follow-ups. Durable inbound cursors process all messages, regardless of read/unread status. A failed or backlogged mailbox check blocks outgoing mail.

SMTP cannot offer a transactional exactly-once guarantee with Postgres. A connection loss after submission may mean Titan accepted the email. The agent marks such attempts Needs review and never automatically resends them. Check Titan Sent searches the deterministic Message-ID. If found, acceptance is recorded without another send. If absent, leave it stopped and investigate manually. Reconciliation schedules the next interval from confirmation time, conservatively delaying any next message.

There is an unavoidable short race between the last inbox scan and SMTP submission: a reply arriving in that instant cannot recall a message already submitted. Replies are processed before the next send. Refresh/forwarding latency can also delay detection.

## Verification
```powershell
npm test
npm run build
npm audit
# Optional regression against the provided local workbook:
$env:LEADS_TEST_FILE = "$PWD/data/Edutrip_School_Leads.xlsx"
npm test
```
Tests exercise a real embedded Postgres engine (PGlite), sequence boundaries, deduplication, replies during a reserved send, late replies, caps, SMTP ambiguity and role privileges. Titan credentials, real Supabase Auth/RLS, DNS and production cron must also be tested after deployment configuration; they cannot be verified offline.

See [Deliverability strategy](docs/DELIVERABILITY.md) and [Operations](docs/OPERATIONS.md).
