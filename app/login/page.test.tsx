import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

describe("LoginPage", () => {
  it("offers an unchecked remember-me option", async () => {
    const html = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toMatch(
      /<input(?=[^>]*id="remember-me")(?=[^>]*name="rememberMe")(?=[^>]*type="checkbox")[^>]*>/,
    );
    expect(html).toContain("Remember me for 30 days");
    expect(html).not.toMatch(/id="remember-me"[^>]*checked/);
  });

  it("shows a friendly configuration message", async () => {
    const html = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({ error: "configuration" }) }),
    );

    expect(html).toContain("The app is not configured. Check the server logs.");
  });
});
