import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  perplexitySearch: vi.fn(),
}));

vi.mock("ai", () => ({
  gateway: { tools: { perplexitySearch: mocks.perplexitySearch } },
  generateText: mocks.generateText,
}));

import { searchWeb } from "./web-search";
import agent from "../agent";

describe("searchWeb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.perplexitySearch.mockReturnValue({ id: "gateway.perplexity_search" });
  });

  it("runs a provider-neutral Gateway search and returns structured results", async () => {
    mocks.generateText.mockResolvedValue({
      toolResults: [
        {
          output: {
            id: "search-1",
            results: [
              {
                date: "2026-06-19",
                snippet: "The relevant result.",
                title: "Example result",
                url: "https://example.com/result",
              },
            ],
          },
        },
      ],
    });

    const result = await searchWeb({
      maxResults: 3,
      query: "current AI news",
      recency: "week",
    });

    expect(mocks.perplexitySearch).toHaveBeenCalledWith({
      maxResults: 3,
      maxTokens: 6_000,
      maxTokensPerPage: 1_200,
      searchRecencyFilter: "week",
    });
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: agent.model,
        toolChoice: { toolName: "perplexity_search", type: "tool" },
      }),
    );
    expect(result).toEqual({
      query: "current AI news",
      results: [
        {
          date: "2026-06-19",
          snippet: "The relevant result.",
          title: "Example result",
          url: "https://example.com/result",
        },
      ],
    });
  });

  it("fails clearly when Gateway search returns an error", async () => {
    mocks.generateText.mockResolvedValue({
      toolResults: [
        {
          output: {
            error: "rate_limit",
            message: "Search rate limit reached.",
            statusCode: 429,
          },
        },
      ],
    });

    await expect(searchWeb({ query: "current AI news" })).rejects.toThrow(
      "Web search failed: Search rate limit reached.",
    );
  });

  it("rejects malformed Gateway output at the boundary", async () => {
    mocks.generateText.mockResolvedValue({ toolResults: [{ output: null }] });

    await expect(searchWeb({ query: "current AI news" })).rejects.toThrow(
      "Web search failed: AI Gateway returned an invalid search result.",
    );
  });
});
