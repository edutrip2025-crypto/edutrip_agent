# Outreach operations

## Every alternate day
Upload the updated Excel. Review the import summary: new, existing, rejected. Resolve conflicting school/email identities deliberately. Qualify only contacts with a documented basis. Re-imports are safe even when the workbook's status columns are outdated.

## Daily
Check replies in Titan, then inspect the dashboard. Confirm the last worker and successful inbox-sync times are recent (within approximately 30 minutes on the 15-minute schedule). Investigate any error, bounce or complaint before resuming. Review unmatched replies and mark the corresponding school Replied when appropriate. The dashboard refreshes every 30 seconds.

The worker does not write personalized replies or negotiate pricing. Once a school responds, you take over.

## Setup acceptance test (controlled mailbox only)
1. Verify the Supabase schema and admin login; attempt a private API request without authentication and confirm rejection.
2. Keep real leads unqualified. Import one test school whose recipient is a mailbox you control.
3. Verify the sender name, postal address and all four templates.
4. Run Check replies; confirm both the reply destination and sender mailbox can be scanned.
5. Enable sending only for this qualified test record and observe one introduction during an eligible window.
6. Re-import it: confirm no second introduction and unchanged sent count.
7. Reply from the test address via the actual Reply-To alias. Check replies, confirm the lead is Replied and has no next send.
8. Test a controlled unsubscribe and confirm re-import does not reactivate it.
9. Disable sending before importing/qualifying the production list. Review DNS headers, source quality and Titan policy fit before enabling.

Do not shorten production follow-up intervals for testing. Automated tests cover all four steps without sending real messages.

## Recovery
- Sync failure/backlog: outgoing mail remains blocked; fix credentials, folder paths or the oversized message in the dedicated mailbox. The worker scans up to 150 messages per folder per run. No message is deleted or marked read by the agent.
- Unknown SMTP result: use Check Titan Sent. A matching Message-ID records the previous acceptance without resending. Absence is not proof that Titan did not send; manual investigation remains necessary.
- Credentials rotated: update the production secret environment variables and redeploy. Never paste credentials into chat or commit them.
- Template change: Save & approve pauses sending. Review before resuming.
- Missed cron: no local browser has to remain open. Check Vercel production cron logs. Once fixed, overdue follow-ups resume subject to the cap and window; no burst catch-up.
- Supabase outage: requests fail rather than recording success. If acceptance was already attempted, that attempt requires reconciliation.
- Public signup or admin changes: maintain the exact server email allowlist. Remove a former admin from it immediately to deny their existing token on the next request.
- Data retention: retain minimal suppression history so removed leads do not get contacted again. Restrict access to message excerpts. Set an appropriate retention policy for your business before accumulating long-term inbox content.

## Remote setup pending
The user will create the separate Supabase project. Production SMTP/IMAP credentials and alias routing must be supplied through environment variables. No school email has been sent as part of implementation.

