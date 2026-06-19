import type {
  NextInstrumentationErrorContext,
  NextInstrumentationRequest,
} from "evlog/next/instrumentation";
import { log } from "./evlog";

export function register() {
  log.info({ event: "runtime.started" });
}

export function onRequestError(
  error: Error & { readonly digest?: string },
  request: NextInstrumentationRequest,
  context: NextInstrumentationErrorContext,
) {
  log.error({
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
