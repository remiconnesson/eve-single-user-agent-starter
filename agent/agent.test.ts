import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("agent configuration", () => {
  it("loads without an AI Gateway API key", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");

    await expect(import("./agent")).resolves.toBeDefined();
  });
});
