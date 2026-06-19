import { createGateway } from "ai";
import { defineAgent } from "eve";

const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_GATEWAY_API_KEY is required.");
}

const gateway = createGateway({ apiKey });

export default defineAgent({
  model: gateway("anthropic/claude-sonnet-4.6"),
  modelContextWindowTokens: 1_000_000,
});
