# Service workflow rollout

## Implemented

- Interview upload progress, bounded timeouts, offline warnings, safe retry, and optional device-local recovery of completed recordings.
- Owner setup checklist and Discord connection/approval-role checks.
- Applicant-owned status page at `/application-status/<interview-session-id>`, with optional future Discord DM updates.
- Reviewer assignments and private team notes, plus existing review filters and oldest/newest ordering.
- Append-only question and application templates; owners still explicitly save configuration.
- Monthly allowance overview, configuration health and 30-day application/submission/review metrics.
- Opt-in daily reminders for applications waiting over 48 hours after submission. Legacy applications without a submission timestamp fall back to creation time.

Guided Voice still has audio only: no written transcripts, AI reviews, scores or voice analysis. GPT Realtime retains those features. Recovery stores transcript lines only for Realtime.

## Database

Applied `20260911162143_service_workflow.sql` to VellaView (`snpncwphpazzfmxfjrgg`) on 2026-09-11. Do not reapply it to this project. It adds five private tables, indexes, service-only invoker functions and a status notification trigger. Existing customer data and billing are not rewritten.

Verified all five tables have RLS enabled and deny anonymous/authenticated direct access. Verified all four workflow RPCs deny browser execution and permit the backend service role. APIs independently verify the applicant or the community membership before accessing private data.

The Supabase advisor reports five new informational “RLS enabled, no policy” notices because these are intentionally backend-only tables. It reports no additional security warnings. Two pre-existing warnings remain: [authenticated access to the legacy submit function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This feature rollout is not a guarantee of zero vulnerabilities.

## Release and opt-ins

The application changes must still be released through the existing Cloudflare deployment. No Sites hosting migration is required. No new environment keys are needed. Keep the existing `CRON_SECRET` and `DISCORD_BOT_TOKEN` runtime secrets.

The existing 15-minute Worker schedule now processes service notifications independently of affiliate maintenance. The daily retention schedule remains unchanged. Verify those cron triggers on the deployed Worker. Notification processing leases up to ten jobs at a time and makes up to five attempts; a Discord outage never holds an interview submission open. Delivered queue metadata is cleaned after 30 days.

Applicants enable DM updates on their private status page. Discord privacy settings may prevent delivery. Owners/admins enable staff reminders in the setup/service panel after configuring their private staff webhook. No real applicant test messages or payment transactions were sent during implementation.

## Recovery limitations

Recovery is off by default and should not be used on shared devices. It saves only a finished local recording, not an in-progress live conversation. Copies are scoped to the original account, session and server-issued attempt timestamp. They become unusable after 24 hours; expired bytes are removed when the browser next opens the recovery store. Submission/restart removes the copy when storage is available. Browser storage can be unavailable or evicted.

Original server upload deadlines and quota checks remain in force. A 24-hour local copy does not extend the upload window. Keep the interview tab open until submission is confirmed. Recovery may still require reupload after a page reload, so a previously unlinked upload does not guarantee recovery after the deadline.

## Verification

All 81 automated regression, isolated PostgreSQL, access-control and upload tests pass. A production Cloudflare build and normal type check passed before the final queue-order UI change. The final source-only, in-memory TypeScript check also passed with zero diagnostics.

The disk-space blocker was resolved before release. The final `npm run build:vinext` passes, all 81 tests pass again, and the source-only in-memory TypeScript check reports zero diagnostics. The build sanitizer removed the generated development-secret artifact and scanned the deployable output. The normal Next.js-generated validator has route-export mismatches with Vinext-generated declarations; the source check excludes generated `.next` artifacts without changing application compiler settings.

Before public rollout, perform signed-in browser checks with a test community: submit one Guided and one Realtime interview, exercise a recoverable connection failure, refresh a completed recovery attempt, assign a reviewer/add a private note, inspect applicant isolation, and explicitly opt in test Discord recipients. These microphone/authenticated browser and Discord delivery checks have not been completed in this environment.
