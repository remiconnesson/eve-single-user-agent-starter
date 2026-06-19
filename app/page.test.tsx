import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import agent from "@/agent/agent";
import Page from "./page";

vi.mock("@/lib/auth/page", () => ({ requireAuthenticatedPage: vi.fn() }));

describe("Page", () => {
  it("passes the Eve agent model to the chat", async () => {
    const page = await Page();
    if (!isValidElement<{ readonly model: string }>(page)) {
      throw new TypeError("Expected Page to return a React element.");
    }

    expect(page.props.model).toBe(agent.model);
  });
});
