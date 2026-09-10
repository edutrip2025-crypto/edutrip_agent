# Edutrip email strategy
Prepared 10 September 2026.

## Before the first campaign
Use an identifiable Edutrip mailbox on an authenticated domain or clearly branded subdomain. Do not rotate domains, aliases or accounts to escape limits or reputation problems. Aliases route replies; they do not create new reputation or quota allowances.

Publish the exact SPF record specified by Titan (one SPF record per domain), enable Titan DKIM, and publish aligned DMARC. Start DMARC monitoring as appropriate for your domain's existing senders, review reports, then strengthen enforcement when all legitimate senders are aligned. Do not change existing DNS blindly. Use TLS. Check actual message headers on an inbox you control.

Confirm the outreach is permitted by Titan and applicable rules. Titan's policy restricts unsolicited commercial and bulk email and includes consent requirements. A school email listed publicly is not evidence of affirmative consent. Record the contact basis before qualification. Do not use purchased lists.

Choose a real sender name, monitored From/Reply-To addresses and business postal address. Keep an abuse contact monitored. Use a dedicated outreach mailbox so its inbox can be reviewed without mixing personal correspondence.

## Volume and relevance
Start at 5 total messages per weekday, spaced at least 30 minutes apart between 10 am and 4 pm IST. This is an operational starting point, not an inbox guarantee. Count follow-ups in the same budget. After at least five healthy sending days, increase manually to 8 and then 10 only if there are no complaints and the hard-bounce rate stays below 2%. Never increase automatically just because time passed. The interface's maximum of 50 is a guardrail, not a recommended target or a substitute for Titan account limits.

Contact one relevant school role, not multiple staff at the same school simultaneously. Review campus/location and offer relevance. Prefer simple text, an honest subject, a small and specific request, and a real signature. The drafts ask whether the recipient handles school partnerships and offer a plan outline. Prices are not invented.

No tracking pixels, attachments, URL shorteners, deceptive subjects or fabricated prior conversations. Follow-ups use actual message references to remain in the conversation.

## Opt-outs, replies and failures
Include the visible unsubscribe URL and List-Unsubscribe / one-click headers. GET shows a confirmation page to avoid link-scanner opt-outs; POST suppresses immediately. A reply of STOP also ends the sequence. Never restart unsubscribed/bounced/replied leads by refreshing Excel.

The worker scans the configured reply and sender folders before any send. Any matched reply, even out-of-office, stops automation for human review. A bounce suppresses that lead and pauses the campaign. Review unmatched mail, mailbox sync errors and Needs review records daily.

Review any spam complaint immediately and pause the campaign. Titan SMTP/IMAP does not provide a reliable complaint-feedback API, so the application cannot claim automatic complaint measurement. Track provider warnings and available domain reputation reports manually. Google's guidance recommends keeping reported spam low and below 0.3%; a small campaign should investigate even one complaint rather than waiting for a percentage threshold.

## Qualification sequence
1. Confirm the school's identity and contact role from the cited source.
2. Confirm mid-market fit and local service availability with the school; fees were not verified in the initial research.
3. Establish and record permission or another sending basis permitted by the provider and applicable rules.
4. Send the introduction. Follow up only after at least 72 hours without a detected reply, up to three times.
5. Close after the final 72-hour response window. Preserve the record rather than recycling it into a new campaign.

No email strategy guarantees avoiding spam folders. Authentication, relevance, permission, consistent low volume and honoring responses reduce risk; they do not override provider policies.

## Sources
- [Titan acceptable-use policy](https://support.titan.email/hc/en-us/articles/900000775226-Titan-Acceptable-Use-Policy)
- [Titan email sending limits](https://support.titan.email/hc/en-us/articles/360038836914-How-many-emails-can-I-send-and-receive)
- [Titan configuration for scripts](https://support.titan.email/hc/en-us/articles/4405162224665-Configuring-Titan-on-Email-Scripts)
- [Google sender guidelines](https://support.google.com/mail/answer/81126)
- [Edutrip offerings and subscription plans](https://www.edutripindia.com/)

