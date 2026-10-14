import type { EmailPayload } from "./types";
import type { ChatEmailConfig, ChatEmailJob } from "./policy";

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }

/** Takes no message body, student name or other conversation content. */
export function renderChatNotification(config: ChatEmailConfig, job: ChatEmailJob, to: string): EmailPayload {
  const path = job.recipient_role === "mentor" ? `/mentor-inbox?thread=${encodeURIComponent(job.thread_id)}` : "/mentor";
  const url = new URL(path, config.email.siteUrl).toString();
  const title = "Je hebt een ongelezen chatbericht";
  const text = `${title}\n\nOpen je privégesprek op Het Trade Platform om het bericht te lezen.\n\n${url}\n\nJe kunt e-mailmeldingen voor de chat aanpassen in je gesprek.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#18202b;line-height:1.6;max-width:520px"><h1 style="font-size:22px;font-weight:600">${title}</h1><p>Open je privégesprek op Het Trade Platform om het bericht te lezen.</p><p><a href="${escapeHtml(url)}">Open je gesprek</a></p><p style="font-size:12px;color:#526070">Je kunt e-mailmeldingen voor de chat aanpassen in je gesprek.</p></div>`;
  return { from: config.email.from, to, replyTo: config.email.replyTo, subject: title, html, text,
    tags: [{ name: "chat_notification_id", value: job.id }, { name: "kind", value: "chat_unread" }] };
}
