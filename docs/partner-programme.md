# Dexlyy partner programme — operations and launch checklist

## Implemented policy

- Free applications at `/partners`, manually approved by a Dexlyy **platform admin** at `/admin/partners`.
- 15% of verified live USD product charges after discounts and excluding tax. No commission on sandbox payments, free grants, usage, or activation without payment.
- One commission for each monthly renewal, annual charge, or extra-interview pack purchase. Annual prices are ten months' price; commissions are not multiplied by twelve.
- Consented first-party referral cookie, valid for 30 days. Last accepted link before signup, then permanent billing-account attribution. New accounts only; pre-launch accounts and existing subscribers cannot be retroactively attributed. Code fallback is allowed within 30 days of signup, before first purchase.
- At least 30 days' hold from payment verification; $25 minimum; monthly manual payout review. The pilot **does not execute PayPal Payouts API transfers**.
- Payout address changes require administrator re-verification and a 48-hour hold.

## Before approving your first partner

1. Review the 15% rate against actual AI, hosting, support and payment costs, particularly high-usage and annual plans.
2. Verify the business and recipient country, legal eligibility, identity, and payout method. PayPal subscription access does not imply Payouts API access. Do not promise unsupported payment methods or territories.
3. Have the published pilot terms, disclosures, privacy/retention approach and relevant tax obligations reviewed for your business jurisdiction. The implementation is not a legal compliance certification.
4. Test a **separate sandbox project/app** with successful renewals, annual payments, packs, partial/full refunds, reversals, duplicate and delayed delivery. Never mix sandbox credentials with production.
5. Confirm the live PayPal app webhook URL is `https://dexlyy.com/api/paypal/webhook` and subscribes to: `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REFUNDED`, `PAYMENT.SALE.REVERSED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, plus the existing subscription lifecycle events. This release does not modify the merchant's PayPal app configuration.

## Environment and maintenance

No new public or secret keys are required. Existing `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT`, `PAYPAL_WEBHOOK_ID`, `SUPABASE_SECRET_KEY` (or service-role fallback), Supabase URL, and `CRON_SECRET` must remain runtime-configured.

`worker.ts` delegates normal requests to vinext and runs a Cloudflare scheduled event every 15 minutes. It internally invokes `/api/maintenance/affiliate-events` using `CRON_SECRET`, with no external secret-bearing request. This processes up to ten due financial events and deletes expired referral tokens. No payouts run on a schedule. Watch Cloudflare's scheduled invocation errors and the admin pending-event count. The HTTP maintenance endpoint rejects missing/incorrect bearer credentials.

PayPal also retries unsuccessful webhook deliveries. Durable event records and unique payment/refund keys prevent duplicate commission on retries. Events use separate live/sandbox namespaces. The financial ledger runs before the legacy subscription-state staleness check; an older payment/refund must not be discarded as a stale status update.

The admin reconciliation tool can re-read a sale/capture or a subscription's last 30 days from PayPal. This is not a full historical import: older/missing transactions must be checked individually. Partial refunds can require replaying original PayPal refund notifications and a documented manual reconciliation. Payments observed as partially refunded without a complete history are held for review. Reconciliation can re-open that hold; this is conservative by design.

## Monthly payout runbook

1. Resolve queued financial events. Reconcile eligible partners' PayPal payments/refunds against provider records; investigate unusual conversions or shared payer identities.
2. Select the partner. Confirm identity, country/provider eligibility, and their private payout email. Use **Verify payout recipient**, with an audit note.
3. Resolve any partial-refund holds. Compare all provider refunds with the displayed recorded totals, replay missing verified refund notifications, then select **Confirm partial refunds reconciled** with a specific audit note.
4. Select **Reserve eligible balance for payout**. The database atomically reserves mature unallocated earnings net of adjustments. It prevents multiple open payouts, sub-$25 payouts and a second paid payout in the same UTC month.
5. Export the payout worksheet if useful. It contains private recipient details; store it securely. It is a review worksheet, **not a PayPal batch-upload file**. No money has moved yet.
6. Refresh and check events/holds and recipient details immediately before sending through the verified payout provider. Send exactly the reserved USD amount to the recipient snapshot. Do not retry a provider transfer until its outcome is known.
7. After provider-confirmed success, select **Record an externally completed payout**, enter the actual unique receipt/reference and audit note. Recording a receipt does not send money.
8. If not sent, **Cancel reservation** releases the ledger rows. Never cancel/re-send an ambiguous or completed external transfer; escalate for accounting reconciliation instead. Refunds after payout create negative adjustments against future earnings.

## Security model

- All affiliate tables have RLS enabled and no client grants. Only server routes can read/write them. Financial RPCs are service-role-only, `SECURITY INVOKER`, with an empty search path. No new SECURITY DEFINER functions or auth-schema access grants.
- Verified Auth identities are registered server-side in a dedicated customer table. Browser-submitted IDs, commission amounts, signup dates and roles are never trusted.
- Partner reads are scoped to the authenticated user's partner ID; responses exclude customer identities, transcripts, payment IDs and private event payloads. Admin routes require active `platform_staff.role = admin` — server administrators and platform support agents are not financial admins.
- Mutations require exact same origin, authentication, bounded request bodies, validation and rate limiting. Signed webhook verification precedes financial processing. PayPal amounts and ownership are re-read from fixed provider API paths.
- Payment and refund deduplication, partner-row locks, immutable ledger adjustments, immutable recipient snapshots during payout, monthly payout checks and audit notes protect accounting integrity.
- Shared payer IDs/emails and direct self-referrals are excluded where known. This is not complete fraud detection: manually investigate related accounts and abuse. There is no device fingerprinting.
- Dependency audit reported no production advisories at implementation time. Supabase still reports two **pre-existing** warnings: authenticated access to the identity-checking `submit_interview` SECURITY DEFINER RPC (used by existing interview submission), and disabled leaked-password protection (site currently uses Discord login). Neither was changed by this feature; review separately. These are not a guarantee that no vulnerabilities exist.

## Verification and reproduction

Temporary test tools are excluded from source control:

```powershell
npm install --prefix .affiliate-tools --no-save --package-lock=false @electric-sql/pglite@0.3.14 playwright@1.56.1
node tests/affiliate-database.test.mjs
node tests/affiliate-security.test.mjs
node tests/staff-invite.test.mjs
node tests/interview-regression.test.mjs
npm run build:vinext
npx --no-install next typegen
npm run typecheck
```

Database tests run in isolated in-memory Postgres, with no auth.users access for service_role. Browser QA was run against synthetic API responses at 1440px and 390px, covering scroll limits, horizontal overflow, admin confirmation and referral consent. Local browser harness files are intentionally untracked; no customer credentials or real financial data were used. Before real payouts, provider sandbox and merchant-account eligibility checks remain necessary.

The built Worker also passed public-page, anonymous/admin denial, cross-origin rejection, unsigned-webhook rejection and scheduled-event checks locally. Wrangler 4.127.1 has a reported [local proxy crash on early rejection of unread request bodies](https://github.com/cloudflare/workers-sdk/issues/15203); local CSRF smoke requests omit the body to avoid this tooling failure. Production smoke requests retain their bodies. Application origin and authentication checks are not weakened.

## Rollback

Redeploy the preceding application version if a release issue appears. Leave additive affiliate tables and financial records intact; never delete commissions or payout records as a rollback. Pause affected partners in admin operations if accounting needs investigation. Do not clear or reset Supabase.
