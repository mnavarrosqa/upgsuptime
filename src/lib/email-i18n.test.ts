import { describe, expect, it } from "vitest";
import { emailFormat, emailT, getEmailMessages } from "@/lib/email-i18n";

describe("email i18n", () => {
  it("loads Spanish degradation subject", async () => {
    const messages = await getEmailMessages("es");
    const subject = emailFormat(messages.degradation.subject, {
      name: "API",
      ratio: "2.5",
    });
    expect(subject).toContain("Lento");
    expect(subject).toContain("API");
  });

  it("loads English uptime subject", async () => {
    const messages = await getEmailMessages("en");
    expect(
      emailFormat(messages.uptime.subjectUp, { name: "Site" }),
    ).toBe("[Up] Site — back online");
  });

  it("resolves nested keys via emailT", async () => {
    const messages = await getEmailMessages("es");
    expect(emailT(messages, "uptime.badgeUp")).toBe("En línea");
  });
});
