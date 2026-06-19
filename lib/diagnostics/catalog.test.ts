import { describe, expect, it } from "vitest";
import {
  diagnostics,
  getDiagnosticLogFields,
  toDiagnosticLogFields,
} from "./catalog";

describe("diagnostic log fields", () => {
  it("serializes Nostics details for logs", () => {
    expect(toDiagnosticLogFields(diagnostics.EVE_R001())).toEqual({
      code: "EVE_R001",
      docs:
        "https://github.com/remiconnesson/eve-single-user-agent-starter/blob/main/docs/diagnostics/eve_r001.md",
      fix: "Retry the request once. If it fails again, inspect Vercel logs for this code and request ID.",
      why: "The agent could not complete the request.",
    });
  });

  it("only resolves known diagnostic codes from untrusted input", () => {
    expect(getDiagnosticLogFields("EVE_R002")).toMatchObject({ code: "EVE_R002" });
    expect(getDiagnosticLogFields("ATTACKER_001")).toBeUndefined();
    expect(getDiagnosticLogFields({ code: "EVE_R001" })).toBeUndefined();
  });

  it("resolves every registered diagnostic without a parallel code list", () => {
    for (const [code, createDiagnostic] of Object.entries(diagnostics)) {
      expect(getDiagnosticLogFields(code)).toEqual(
        toDiagnosticLogFields(createDiagnostic()),
      );
    }
  });

  it.each(["__proto__", "constructor", "hasOwnProperty", "toString"])(
    "rejects inherited object key %s",
    (code) => {
      expect(getDiagnosticLogFields(code)).toBeUndefined();
    },
  );
});
