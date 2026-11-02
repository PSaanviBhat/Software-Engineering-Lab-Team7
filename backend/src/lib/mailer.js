const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 2525),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

// The one function every feature uses to send mail.
async function sendMail({ to, subject, html }) {
  return getTransporter().sendMail({
    from: process.env.MAIL_FROM || "Peer Tutoring <no-reply@tutoring.local>",
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };