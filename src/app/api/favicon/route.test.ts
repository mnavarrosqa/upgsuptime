import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/url-allowed", () => ({
  getUrlNotAllowedReason: vi.fn(async (url: string) =>
    new URL(url).hostname === "127.0.0.1" ? "URL points to a disallowed address" : null,
  ),
}));

const ICON = new Uint8Array([1, 2, 3]);

describe("GET /api/favicon", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not follow a direct-origin redirect to a disallowed address", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://evil.example/")) {
        return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/secret.ico" } });
      }
      if (url.startsWith("http://127.0.0.1")) {
        return new Response(ICON, { headers: { "Content-Type": "image/x-icon" } });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/favicon?domain=evil.example"));

    expect(fetchMock.mock.calls.map(([u]) => u)).not.toContain("http://127.0.0.1/secret.ico");
    expect(res.headers.get("Content-Type")).toBe("image/png"); // placeholder
  });

  it("follows a direct-origin redirect to an allowed host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://site.example/favicon.ico") {
          return new Response(null, { status: 301, headers: { Location: "https://cdn.example/icon.ico" } });
        }
        if (url === "https://cdn.example/icon.ico") {
          return new Response(ICON, { headers: { "Content-Type": "image/x-icon" } });
        }
        return new Response(null, { status: 404 });
      }),
    );
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/favicon?domain=site.example"));

    expect(res.headers.get("Content-Type")).toBe("image/x-icon");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(ICON);
  });

  it("answers with a fully transparent placeholder when no icon is found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/favicon?domain=site.example"));

    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1, 1]);
    expect(data[3]).toBe(0); // alpha
  });
});
