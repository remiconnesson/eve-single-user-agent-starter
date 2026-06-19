import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-4.6",
  modelContextWindowTokens: 1_000_000,
});
