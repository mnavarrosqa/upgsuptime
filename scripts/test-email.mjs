// Usage: node --env-file=.env scripts/test-email.mjs [recipient@example.com]
import nodemailer from "nodemailer";

const to = process.argv[2] ?? process.env.SMTP_USER;
if (!to) {
  console.error("Usage: node --env-file=.env scripts/test-email.mjs <recipient>");
  process.exit(1);
}

const host = process.env.SMTP_HOST;
if (!host) {
  console.error("SMTP_HOST is not set");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port: parseInt(process.env.SMTP_PORT ?? "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
    : undefined,
});

console.log(`Sending test email to ${to} via ${host}:${process.env.SMTP_PORT ?? 587}…`);

try {
  await transporter.verify();
  console.log("SMTP connection OK");

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"UPG Monitor" <${process.env.SMTP_USER}>`,
    to,
    subject: "UPG Monitor — SMTP test",
    text: "If you received this, your SMTP configuration is working correctly.",
  });

  console.log("Email sent:", info.messageId);
} catch (err) {
  console.error("Failed:", err.message);
  process.exit(1);
}
