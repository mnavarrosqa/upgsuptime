import { timingSafeEqual } from "crypto";

export function validateCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (typeof expected !== "string" || expected.length === 0) {
    return false;
  }
  if (provided === null || provided === "") {
    return false;
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
