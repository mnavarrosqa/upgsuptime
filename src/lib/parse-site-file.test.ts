import { describe, expect, it } from "vitest";
import {
  parseSitesFromCsvString,
  parseSitesFromPlainText,
  splitCsvLine,
} from "@/lib/parse-site-file";

describe("splitCsvLine", () => {
  it("splits simple fields", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted commas", () => {
    expect(splitCsvLine('"Site, Inc",https://a.com')).toEqual([
      "Site, Inc",
      "https://a.com",
    ]);
  });
});

describe("parseSitesFromPlainText", () => {
  it("parses one URL per line", () => {
    const r = parseSitesFromPlainText("https://a.com\nhttps://b.com\n");
    expect(r).toHaveLength(2);
    expect(r[0]?.url).toBe("https://a.com");
    expect(r[1]?.url).toBe("https://b.com");
  });

  it("skips empty lines and hash comments", () => {
    const r = parseSitesFromPlainText("\n# skip\nhttps://x.com\n");
    expect(r).toHaveLength(1);
  });
});

describe("parseSitesFromCsvString", () => {
  it("uses url column header", () => {
    const csv = "name,url\nMy API,https://api.example.com\n";
    const r = parseSitesFromCsvString(csv);
    expect(r).toHaveLength(1);
    expect(r[0]?.name).toBe("My API");
    expect(r[0]?.url).toBe("https://api.example.com");
  });

  it("infers two columns without header as name,url", () => {
    const csv = "Home,https://home.example.com\n";
    const r = parseSitesFromCsvString(csv);
    expect(r[0]?.name).toBe("Home");
    expect(r[0]?.url).toBe("https://home.example.com");
  });
});
