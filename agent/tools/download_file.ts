import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  downloadSandboxFile,
  downloadSandboxFileOutputSchema,
  sandboxFilePathSchema,
} from "../lib/sandbox-files";

const downloadFileInputSchema = z.object({
  path: sandboxFilePathSchema.describe(
    "Path to a file inside /workspace, either relative (reports/output.csv) or absolute (/workspace/reports/output.csv)",
  ),
});

export default defineTool({
  description:
    "Prepare a file from the current sandbox for the user to download. Use the relative or /workspace path shown by tools and attached files. Files must be 3 MiB or smaller.",
  async execute({ path }, context) {
    const sandbox = await context.getSandbox();
    return downloadSandboxFile({ path, sandbox });
  },
  inputSchema: downloadFileInputSchema,
  outputSchema: downloadSandboxFileOutputSchema,
  toModelOutput(output) {
    return {
      type: "text",
      value: `Prepared ${output.path} (${output.byteLength} bytes) for download.`,
    };
  },
});
