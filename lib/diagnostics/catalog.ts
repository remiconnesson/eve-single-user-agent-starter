import { Diagnostic, defineDiagnostics } from "nostics";

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
      fix: "Open Diagnostics, copy the support report, then retry the request once.",
    },
    EVE_R002: {
      why: "A file could not be uploaded to the sandbox.",
      fix: "Choose one file no larger than 3 MiB, then retry the upload.",
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
    case "EVE_C003":
      return toPublicDiagnostic(diagnostics.EVE_C003());
    case "EVE_C004":
      return toPublicDiagnostic(diagnostics.EVE_C004());
    case "EVE_R001":
      return toPublicDiagnostic(diagnostics.EVE_R001());
    case "EVE_R002":
      return toPublicDiagnostic(diagnostics.EVE_R002());
    default:
      return undefined;
  }
}
