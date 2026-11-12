import { describe, expect, it } from "vitest";
import { getSiteOrigin } from "./site-url";

describe("getSiteOrigin", () => {
  it("uses the HTTPS origin for production invitation redirects", () => {
    expect(getSiteOrigin("https://tickets.example.com/app", "production"))
      .toBe("https://tickets.example.com");
  });

  it("rejects HTTP invitation redirects outside localhost development", () => {
    expect(() => getSiteOrigin("http://tickets.example.com", "production"))
      .toThrow("HTTP is allowed only for localhost during development.");
    expect(() => getSiteOrigin("http://tickets.example.com", "development"))
      .toThrow("HTTP is allowed only for localhost during development.");
  });

  it("allows localhost HTTP only in development", () => {
    expect(getSiteOrigin("http://localhost:3000", "development"))
      .toBe("http://localhost:3000");
    expect(() => getSiteOrigin("http://localhost:3000", "production"))
      .toThrow("HTTP is allowed only for localhost during development.");
  });

  it("uses the local default only in development", () => {
    expect(getSiteOrigin(undefined, "development")).toBe("http://localhost:3000");
    expect(() => getSiteOrigin(undefined, "production"))
      .toThrow("Set NEXT_PUBLIC_SITE_URL to this app's public URL before sending invitations.");
  });

  it("rejects credential-bearing and non-web URLs", () => {
    expect(() => getSiteOrigin("https://user:pass@example.com", "production"))
      .toThrow("NEXT_PUBLIC_SITE_URL must be an HTTPS URL.");
    expect(() => getSiteOrigin("ftp://example.com", "production"))
      .toThrow("NEXT_PUBLIC_SITE_URL must be an HTTPS URL.");
  });
});
