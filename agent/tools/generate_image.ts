import { defineTool } from "eve/tools";
import {
  generateImageInSandbox,
  imageGenerationInputSchema,
  imageGenerationOutputSchema,
} from "../lib/image-generation";

export default defineTool({
  description:
    "Generate an image with OpenAI GPT Image 2 and save it in the current sandbox. Returns the sandbox path so the file can be downloaded.",
  inputSchema: imageGenerationInputSchema,
  outputSchema: imageGenerationOutputSchema,
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    return generateImageInSandbox({ input, sandbox });
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        byteLength: output.byteLength,
        filename: output.filename,
        mediaType: output.mediaType,
        model: output.model,
        path: output.path,
      },
    };
  },
});
