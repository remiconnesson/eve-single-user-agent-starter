import type { NextRequest } from "next/server";
import { hasAuthorizedAccess } from "@/lib/auth/access";
import { readDiagnosticReport } from "@/lib/diagnostics/report";
import { useLogger, withEvlog } from "@/lib/evlog";

export const GET = withEvlog(async (request: NextRequest) => {
  const isAuthenticated = await hasAuthorizedAccess(request.headers.get("cookie"));
  if (!isAuthenticated) {
    useLogger().set({ diagnostics: { outcome: "denied" } });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = readDiagnosticReport();
  useLogger().set({
    diagnostics: {
      codes: report.diagnostics.map((diagnostic) => diagnostic.code),
      outcome: "generated",
      status: report.status,
    },
  });
  return Response.json(report, {
    headers: { "cache-control": "no-store" },
  });
});
