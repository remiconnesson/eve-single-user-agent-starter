import type {
  NextInstrumentationErrorContext,
  NextInstrumentationRequest,
} from "evlog/next/instrumentation";
import { Diagnostic } from "nostics";
import { toDiagnosticLogFields } from "./diagnostics/catalog";
import { readConfigurationDiagnostics } from "./diagnostics/configuration";
import { log } from "./evlog";

export function register() {
  const configurationDiagnostics = readConfigurationDiagnostics().map(
    toDiagnosticLogFields,
  );
  const entry = {
    configuration: {
      diagnostics: configurationDiagnostics,
      status: configurationDiagnostics.length === 0 ? "healthy" : "needs_attention",
    },
    event: "runtime.started",
  } as const;

  if (configurationDiagnostics.length > 0) {
    log.warn(entry);
  } else {
    log.info(entry);
  }
}

export function onRequestError(
  error: Error & { readonly digest?: string },
  request: NextInstrumentationRequest,
  context: NextInstrumentationErrorContext,
) {
  const diagnostic =
    error instanceof Diagnostic ? toDiagnosticLogFields(error) : undefined;
  log.error({
    ...(diagnostic ? { diagnostic } : {}),
    error: {
      digest: error.digest,
      message: error.message,
      name: error.name,
    },
    event: "next.request_failed",
    request: {
      method: request.method,
      path: request.path,
      route: context.routePath,
      routeType: context.routeType,
    },
  });
}
