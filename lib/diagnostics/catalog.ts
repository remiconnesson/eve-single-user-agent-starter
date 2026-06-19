import type { Diagnostic } from "nostics";
import { defineDiagnostics } from "nostics";

const DIAGNOSTICS_BASE_URL =
  "https://github.com/remiconnesson/eve-single-user-agent-starter/blob/main/docs/diagnostics";

export const diagnostics = defineDiagnostics({
  docsBase: (code) => `${DIAGNOSTICS_BASE_URL}/${code.toLowerCase()}.md`,
  codes: {
    EVE_C001: {
      why: "EVE_ACCESS_PASSWORD is required in production.",
      fix: "Add a private EVE_ACCESS_PASSWORD to the Production environment in Vercel, then redeploy.",
    },
    EVE_C003: {
      why: "Local AI Gateway credentials are missing.",
      fix: "Run `vercel link`, then `vercel env pull .env.local`, and restart the development server.",
    },
    EVE_C004: {
      why: "This project requires Node.js 24 or newer.",
      fix: "Install Node.js 24, reinstall dependencies with pnpm, and restart the app.",
    },
    EVE_R001: {
      why: "The agent could not complete the request.",
      fix: "Retry the request once. If it fails again, inspect Vercel logs for this code and request ID.",
    },
    EVE_R002: {
      why: "A file could not be uploaded to the sandbox.",
      fix: "Choose one file no larger than 3 MiB, then retry the upload.",
    },
  },
});

export interface DiagnosticLogFields {
  readonly code: string;
  readonly docs?: string;
  readonly fix?: string;
  readonly why: string;
}

export function toDiagnosticLogFields(diagnostic: Diagnostic): DiagnosticLogFields {
  return {
    code: diagnostic.name,
    docs: diagnostic.docs,
    fix: diagnostic.fix,
    why: diagnostic.why,
  };
}

export function getDiagnosticLogFields(code: unknown): DiagnosticLogFields | undefined {
  if (typeof code !== "string" || !hasOwn(diagnostics, code)) return undefined;
  return toDiagnosticLogFields(diagnostics[code]());
}

function hasOwn<ObjectType extends object>(
  value: ObjectType,
  key: PropertyKey,
): key is keyof ObjectType {
  return Object.hasOwn(value, key);
}
