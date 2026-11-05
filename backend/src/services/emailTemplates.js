const TZ = process.env.MAIL_TIMEZONE || "Asia/Kolkata";

// Names, subjects and links come from users, so escape them before they go into HTML.
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(date) {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function details(booking) {
  const { slot, learner } = booking;
  const where = slot.mode === "ONLINE" ? `Online: ${esc(slot.link || "link to follow")}` : "In person";
  return `
    <p><b>Subject:</b> ${esc(slot.subject)}</p>
    <p><b>Learner:</b> ${esc(learner.name)}</p>
    <p><b>Tutor:</b> ${esc(slot.tutor.name)}</p>
    <p><b>When:</b> ${formatWhen(slot.startUtc)}</p>
    <p><b>Where:</b> ${where}</p>`;
}

const SUBJECTS = {
  CONFIRMATION: "Your tutoring session is confirmed",
  REMINDER_24H: "Reminder: your tutoring session is in 24 hours",
  REMINDER_1H: "Reminder: your tutoring session starts in 1 hour",
};

// One message addressed to both the learner and the tutor (SRS F-019, TC-NOTIF-01).
// A single message means a retry can never send one person a duplicate.
function buildEmail(type, booking) {
  const subject = SUBJECTS[type];
  if (!subject) throw new Error(`Unknown email type: ${type}`);
  const { learner, slot } = booking;
  return {
    to: [learner.email, slot.tutor.email],
    subject,
    html: `<p>Hi ${esc(learner.name)} and ${esc(slot.tutor.name)},</p>${details(booking)}`,
  };
}

module.exports = { buildEmail, formatWhen };