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
  const emailHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#10221b"><h2>New Dexlyy owner feedback</h2><p><strong>Type:</strong> ${escapeHtml(category)}</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><p><strong>From:</strong> ${escapeHtml(ownerLabel)}</p><p><strong>Page:</strong> ${escapeHtml(pagePath || "Unknown")}</p><hr><p style="white-space:pre-wrap">${escapeHtml(message)}</p><p style="color:#71857b;font-size:12px">Feedback ID: ${escapeHtml(feedback.id)}</p></div>`;
  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [SUPPORT_EMAIL], subject: `[${category}] ${subject}`, html: emailHtml }),
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
