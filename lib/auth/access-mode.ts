export type AccessMode = "development" | "password" | "preview";

export function resolveAccessMode(
  environment?: {
    readonly nodeEnv?: string;
    readonly vercelEnv?: string;
  },
): AccessMode {
  const nodeEnv = environment ? environment.nodeEnv : process.env.NODE_ENV;
  const vercelEnv = environment ? environment.vercelEnv : process.env.VERCEL_ENV;

  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";
  if (vercelEnv === "production") return "password";
  if (nodeEnv === "development") return "development";
  return "password";
}
