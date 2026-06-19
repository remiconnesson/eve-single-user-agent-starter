import { defineTool } from "eve/tools";
import {
  searchWeb,
  webSearchInputSchema,
  webSearchOutputSchema,
} from "../lib/web-search";

export default defineTool({
  description:
    "Search the public web for current information and sources. Use this for recent events, facts that may have changed, or claims that need URLs.",
  execute: searchWeb,
  inputSchema: webSearchInputSchema,
  outputSchema: webSearchOutputSchema,
});
