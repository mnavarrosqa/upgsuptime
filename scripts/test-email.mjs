// Usage:
//   node --env-file=.env scripts/test-email.mjs [recipient@example.com]
//   node --env-file=.env scripts/test-email.mjs [recipient] --template uptime-down
//
// Templates: uptime-down, uptime-up, ssl-expiring, degradation
import { spawnSync } from "node:child_process";
import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const templateIdx = args.indexOf("--template");
const template =
  templateIdx >= 0 ? args[templateIdx + 1] : args.find((a) => a.startsWith("--template="))?.split("=")[1];
const to = args.find((a) => !a.startsWith("--") && a !== template) ?? process.env.SMTP_USER;

if (!to) {
  console.error(
    "Usage: node --env-file=.env scripts/test-email.mjs <recipient> [--template uptime-down]",
  );
  process.exit(1);
}

if (template) {
  const result = spawnSync(
    "npx",
    ["vitest", "run", "src/lib/send-template-email.test.ts"],
    {
      stdio: "inherit",
      cwd: root,
      env: { ...process.env, EMAIL_TEMPLATE: template, EMAIL_TO: to },
    },
  );
  process.exit(result.status ?? 1);
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
