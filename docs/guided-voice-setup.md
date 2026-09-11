# Guided Voice rollout

Guided Voice and GPT Realtime are separate plan families. Existing Starter,
Small, Medium, Pro and Ultra plans retain their existing features and prices.

| Guided plan | Monthly USD | Yearly USD | Interviews/month |
|---|---:|---:|---:|
| Free | 0 | 0 | 5 |
| Flexi | 5 | 50 | 50 |
| Flow | 10 | 100 | 150 |
| Boost | 15 | 150 | 250 |
| Scale | 25 | 250 | 500 |
| Network | 50 | 500 | 1200 |

All Guided plans use reusable question audio and recorded answers for human
review. They have no written transcripts, AI assessments, AI scores, voice
alteration analysis or live AI conversation. Monthly allowances renew monthly
on annual plans too. Free is five interviews per month.

Migration 20260908191541_guided_voice.sql was applied to VellaView on 2026-09-08.
Do not run it again on that project. Apply it before app deployment in other environments.
This adds a private question-audio bucket, session mode and question snapshots,
a service-only atomic submission RPC, and the new plan keys.

Create five monthly and five yearly PayPal plans with the prices above.
Keep existing PayPal Realtime plans. Add the following runtime TEXT variables
(PayPal plan IDs are public identifiers, not credentials):

    PAYPAL_PLAN_FLEXI=
    PAYPAL_PLAN_FLOW=
    PAYPAL_PLAN_BOOST=
    PAYPAL_PLAN_SCALE=
    PAYPAL_PLAN_NETWORK=
    PAYPAL_PLAN_FLEXI_YEARLY=
    PAYPAL_PLAN_FLOW_YEARLY=
    PAYPAL_PLAN_BOOST_YEARLY=
    PAYPAL_PLAN_SCALE_YEARLY=
    PAYPAL_PLAN_NETWORK_YEARLY=

The existing OPENAI_API_KEY runtime secret generates questions using
gpt-4o-mini-tts. Applicant recordings are never sent to OpenAI for Guided Voice.
No additional public build variables are necessary for these plans: the billing
status endpoint returns configured runtime plan IDs. Missing IDs disable checkout.
Free activation needs no PayPal plan and cannot replace an existing billing row.

Guided recording uses 64 kbps, a 20-minute attempt limit, 15 MB maximum upload,
and the existing one-restart policy. Transcription-based quality checks do not
apply to Guided Voice; staff assess spoken-answer quality themselves.
Only submitted interviews count. Guided plans do not spend existing prepaid
Realtime top-up credits.

Verify before release: paid checkout and webhook confirmation, free activation
and repeated activation, cross-account access denial, microphone permission
failure, question replay, final upload retry, monthly quota exhaustion,
duplicate submission and Realtime regression. Use test accounts and sandbox
payments, never real customer charges for verification.
