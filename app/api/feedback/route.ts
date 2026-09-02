import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

const SUPPORT_EMAIL = "support@dexlyy.com";
const CATEGORIES = ["bug", "suggestion", "question", "other"] as const;
type FeedbackCategory = (typeof CATEGORIES)[number];

type FeedbackBody = {
  category?: unknown;
  subject?: unknown;
  message?: unknown;
  pagePath?: unknown;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function buildFeedbackEmail({
  category,
  subject,
  ownerLabel,
  pagePath,
  message,
  feedbackId,
  createdAt,
}: {
  category: FeedbackCategory;
  subject: string;
  ownerLabel: string;
  pagePath: string | null;
  message: string;
  feedbackId: string;
  createdAt: string;
}) {
  const categoryLabels: Record<FeedbackCategory, string> = {
    bug: "Bug report",
    suggestion: "Product idea",
    question: "Question",
    other: "General feedback",
  };
  const categoryLabel = categoryLabels[category];
  const receivedAt = new Date(createdAt).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(categoryLabel)}: ${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f7f4;color:#16251f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">New ${escapeHtml(categoryLabel.toLowerCase())} from ${escapeHtml(ownerLabel)}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f7f4;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce8e1;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;background:#173f31;color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-size:21px;font-weight:700;letter-spacing:-0.3px;">Dexlyy</td>
                    <td align="right"><span style="display:inline-block;padding:6px 10px;border:1px solid #5d8877;border-radius:999px;color:#dff5e9;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Owner feedback</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 28px 30px;">
                <div style="margin-bottom:12px;color:#2f8b65;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(categoryLabel)}</div>
                <h1 style="margin:0 0 10px;color:#16251f;font-size:28px;line-height:1.25;letter-spacing:-0.6px;">${escapeHtml(subject)}</h1>
                <p style="margin:0 0 28px;color:#718078;font-size:14px;line-height:1.6;">A new message was submitted through the Dexlyy feedback centre.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-bottom:22px;border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td width="50%" valign="top" style="padding:14px 16px;background:#f7faf8;border:1px solid #e2ebe6;border-radius:12px 0 0 12px;">
                      <div style="margin-bottom:5px;color:#819087;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Submitted by</div>
                      <div style="color:#263a31;font-size:14px;font-weight:600;word-break:break-word;">${escapeHtml(ownerLabel)}</div>
                    </td>
                    <td width="50%" valign="top" style="padding:14px 16px;background:#f7faf8;border-top:1px solid #e2ebe6;border-right:1px solid #e2ebe6;border-bottom:1px solid #e2ebe6;border-radius:0 12px 12px 0;">
                      <div style="margin-bottom:5px;color:#819087;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Page</div>
                      <div style="color:#263a31;font-size:14px;font-weight:600;word-break:break-word;">${escapeHtml(pagePath || "Unknown")}</div>
                    </td>
                  </tr>
                </table>

                <div style="padding:20px 22px;background:#edf7f1;border-left:4px solid #2f8b65;border-radius:4px 14px 14px 4px;">
                  <div style="margin-bottom:9px;color:#37775d;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Message</div>
                  <div style="color:#20352b;font-size:15px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:19px 28px;background:#f9fbfa;border-top:1px solid #e6eee9;color:#819087;font-size:11px;line-height:1.6;">
                <div>Received ${escapeHtml(receivedAt)}</div>
                <div style="margin-top:3px;word-break:break-all;">Feedback ID&nbsp;&nbsp;${escapeHtml(feedbackId)}</div>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#91a098;font-size:11px;line-height:1.5;">Sent securely from the Dexlyy owner dashboard.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && CATEGORIES.includes(value as FeedbackCategory);
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in to send feedback." }, { status: 401 });
  if (!(await consumeRateLimit(`owner-feedback:${auth.user.id}`, 10, 3600))) {
    return noStoreJson({ error: "You have reached the feedback limit for this hour." }, { status: 429 });
  }

  const body = await readJsonBody<FeedbackBody>(request, 12_000);
  const category = body?.category;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.trim().slice(0, 500) || null : null;
  if (!isFeedbackCategory(category) || subject.length < 3 || subject.length > 120 || message.length < 10 || message.length > 5000) {
    return noStoreJson({ error: "Please choose a feedback type and provide a subject and details." }, { status: 400 });
  }

  const { data: feedback, error: insertError } = await supabase
    .from("owner_feedback")
    .insert({ owner_id: auth.user.id, category, subject, message, page_path: pagePath })
    .select("id,category,subject,message,status,created_at")
    .single();
  if (insertError || !feedback) return noStoreJson({ error: "Your feedback could not be saved." }, { status: 500 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return noStoreJson({ feedback, emailSent: false, warning: "Your feedback was saved, but email delivery is not configured yet." }, { status: 202 });
  }

  const from = process.env.RESEND_FROM_EMAIL || "Dexlyy Feedback <feedback@dexlyy.com>";
  const ownerLabel = auth.user.email || `Discord owner ${auth.user.id}`;
  const categoryLabel = { bug: "Bug report", suggestion: "Product idea", question: "Question", other: "General feedback" }[category];
  const emailHtml = buildFeedbackEmail({
    category,
    subject,
    ownerLabel,
    pagePath,
    message,
    feedbackId: feedback.id,
    createdAt: feedback.created_at,
  });
  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [SUPPORT_EMAIL], subject: `${categoryLabel}: ${subject}`, html: emailHtml }),
      cache: "no-store",
    });
    if (!emailResponse.ok) {
      return noStoreJson({ feedback, emailSent: false, warning: "Your feedback was saved, but the support email could not be delivered." }, { status: 202 });
    }
  } catch {
    return noStoreJson({ feedback, emailSent: false, warning: "Your feedback was saved, but the support email could not be delivered." }, { status: 202 });
  }

  return noStoreJson({ feedback, emailSent: true });
}

