import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import agent from "@/agent/agent";
import Page from "./page";

vi.mock("@/lib/auth/page", () => ({ requireAuthenticatedPage: vi.fn() }));

describe("Page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes the eve agent model to the chat", async () => {
    const page = await Page();
    if (!isValidElement<{ readonly model: string; readonly stopButtonEnabled: boolean }>(page)) {
      throw new TypeError("Expected Page to return a React element.");
    }

    expect(page.props.model).toBe(agent.model);
    expect(page.props.stopButtonEnabled).toBe(false);
  });

  it("enables the stop button from the server-side feature flag", async () => {
    vi.stubEnv("EVE_ENABLE_STOP_BUTTON", "1");

    const page = await Page();
    if (!isValidElement<{ readonly stopButtonEnabled: boolean }>(page)) {
      throw new TypeError("Expected Page to return a React element.");
    }

    expect(page.props.stopButtonEnabled).toBe(true);
  });
});
