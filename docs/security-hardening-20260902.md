# Security hardening — 2 September 2026

## Applied database changes

Migration `20260902133343_security_hardening_storage_and_privileges.sql` was applied to the existing production Supabase project and verified against its migration history.

- Removed anonymous public-table grants and browser TRUNCATE, REFERENCES and TRIGGER privileges.
- Removed unused browser billing/profile/audit writes and destructive deletes handled by authenticated backend routes.
- Recording replacements must resolve to the signed-in applicant's session and an expected recording or voice-sample filename. Normal upload/upsert retries remain supported.
- No customer rows, staff assignments, subscription balances or recordings were deleted by the migration. Service-role access remains unchanged.
- `security-permissions-before-20260902.json` captures pre-change table grants and the storage UPDATE policy, without customer data or credentials. Use only for an explicitly reviewed emergency rollback; restoring it reintroduces the old weaknesses.

## Website changes

- Rate limits use Cloudflare's edge client-IP header rather than untrusted left-most forwarded addresses.
- PayPal webhook verification is rate-limited before provider calls; limiter failures fail closed, and provider/database error details are not returned publicly. Financial signature verification and accounting remain intact.
- Admin login opts out of persistent cookies. Browser, server and proxy cookie writers now enforce that preference after Supabase adds its cookie defaults, while preserving logout deletions and Discord callbacks. Production auth cookies are Secure.
- Added an explicit homepage security-header rule for vinext, preserving PayPal and other existing integrations.
- Public portal reads no longer perform retention deletion. A daily authenticated Worker schedule runs the existing owner-configured retention rules; affiliate maintenance keeps its existing schedule.
- Interview disclosure names OpenAI and explains audio/transcript processing, voice-alteration indicators, human review and retention limitations.
- Cloudflare build/deploy hooks remove generated development-secret files and scan release artifacts for configured server credential values. Source environment files are not removed or published.

## Verification

- 54 isolated tests pass, covering interview submission and retries, staff invites, affiliate accounting, recording-path isolation, cookie serialization and PayPal rejection paths.
- Next.js production build, TypeScript check, Cloudflare production build and release credential scan pass.
- Live permissions confirm anonymous public-table grants and dangerous browser table grants are zero; billing writes remain backend-only; server creation, ticket status updates and authenticated interview submission remain permitted.
- No authenticated production interview, real payment or customer account was created for testing. Full end-to-end Discord/payment testing still requires an authorized test account and provider environment.

## Remaining risks and deliberate exceptions

- Platform-admin MFA and server-enforced session lifetime still need an enrollment/recovery rollout. Session cookies are not MFA, do not revoke stolen tokens, can survive browser session restoration, and apply after a new admin sign-in. Existing sessions are not forcibly revoked.
- The authenticated `submit_interview` SECURITY DEFINER advisor is intentional: the function validates caller ownership, recording linkage, transcript limits and billing atomically. Anonymous execution is denied. Switching it blindly to invoker would break submissions. See [Supabase's advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Service-only tables intentionally have RLS enabled with no browser policies. Do not add broad access to silence [informational notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled. The current UI uses Discord OAuth; enable the protection before introducing password sign-in.
- The existing inline-script CSP allowance is retained for framework/payment compatibility. A stricter nonce-based policy needs separate compatibility testing.
- Improved interview disclosure is not a complete legal/privacy assessment. Referral storage/consent, international processing, provider retention and transcript deletion obligations need jurisdiction-specific review.
- This is targeted hardening, not a guarantee that the project has no vulnerabilities.
