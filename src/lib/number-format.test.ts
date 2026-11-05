import { describe, expect, it } from "vitest";
import { formatNumber, formatPercent } from "./number-format";

describe("formatPercent", () => {
  it("follows the locale", () => {
    expect(formatPercent(99.7, "es")).toBe("99,7 %");
    expect(formatPercent(99.7, "en")).toBe("99.7%");
  });
  it("drops decimals on whole numbers and honours the precision", () => {
    expect(formatPercent(100, "en")).toBe("100%");
    expect(formatPercent(99.1234, "en", 4)).toBe("99.1234%");
  });
});

describe("formatNumber", () => {
  it("groups thousands per locale", () => {
    expect(formatNumber(12320, "es")).toBe("12.320");
    expect(formatNumber(12320, "en")).toBe("12,320");
  });
});
