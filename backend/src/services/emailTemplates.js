const TZ = process.env.MAIL_TIMEZONE || "Asia/Kolkata";

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
  const { slot } = booking;
  const where = slot.mode === "ONLINE" ? `Online: ${slot.link || "link to follow"}` : "In person";
  return `
    <p><b>Subject:</b> ${slot.subject}</p>
    <p><b>Tutor:</b> ${slot.tutor.name}</p>
    <p><b>When:</b> ${formatWhen(slot.startUtc)}</p>
    <p><b>Where:</b> ${where}</p>`;
}

const SUBJECTS = {
  CONFIRMATION: "Your tutoring session is confirmed",
  REMINDER_24H: "Reminder: your tutoring session is in 24 hours",
  REMINDER_1H: "Reminder: your tutoring session starts in 1 hour",
};

// Returns { to, subject, html } for the learner of this booking.
function buildEmail(type, booking) {
  const subject = SUBJECTS[type];
  if (!subject) throw new Error(`Unknown email type: ${type}`);
  return {
    to: booking.learner.email,
    subject,
    html: `<p>Hi ${booking.learner.name},</p>${details(booking)}`,
  };
}

module.exports = { buildEmail, formatWhen };