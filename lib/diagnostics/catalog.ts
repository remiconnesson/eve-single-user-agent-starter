import { Diagnostic, defineDiagnostics } from "nostics";

const DIAGNOSTICS_BASE_URL =
  "https://github.com/remiconnesson/eve-single-user-agent-starter/blob/main/docs/diagnostics";

export const diagnostics = defineDiagnostics({
  docsBase: (code) => `${DIAGNOSTICS_BASE_URL}/${code.toLowerCase()}.md`,
  codes: {
    EVE_C001: {
      why: "EVE_ACCESS_PASSWORD is required.",
      fix: "Add EVE_ACCESS_PASSWORD in Vercel with at least 16 characters, then redeploy.",
    },
    EVE_C002: {
      why: "EVE_ACCESS_PASSWORD must be at least 16 characters.",
      fix: "Replace EVE_ACCESS_PASSWORD in Vercel with a longer unique password, then redeploy.",
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
      fix: "Open Diagnostics, copy the support report, then retry the request once.",
    },
  },
});

export interface PublicDiagnostic {
  readonly code: string;
  readonly docs?: string;
  readonly fix: string;
  readonly why: string;
}

export function toPublicDiagnostic(diagnostic: Diagnostic): PublicDiagnostic {
  return {
    code: diagnostic.name,
    docs: diagnostic.docs,
    fix: diagnostic.fix ?? "Open Diagnostics and copy the support report.",
    why: diagnostic.why,
  };
}

export function getPublicDiagnostic(code: string | undefined): PublicDiagnostic | undefined {
  switch (code) {
    case "EVE_C001":
      return toPublicDiagnostic(diagnostics.EVE_C001());
    case "EVE_C002":
      return toPublicDiagnostic(diagnostics.EVE_C002());
    case "EVE_C003":
      return toPublicDiagnostic(diagnostics.EVE_C003());
    case "EVE_C004":
      return toPublicDiagnostic(diagnostics.EVE_C004());
    case "EVE_R001":
      return toPublicDiagnostic(diagnostics.EVE_R001());
    default:
      return undefined;
  }
}
