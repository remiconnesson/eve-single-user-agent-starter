import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { EvlogProvider } from "evlog/next/client";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const clientLogTransport = {
  enabled: true,
  endpoint: "/api/_evlog/ingest",
} as const;

export const metadata: Metadata = {
  title: "eve Single-User Agent Starter",
  description: "A private single-user eve agent starter built with AI Elements.",
  robots: {
    follow: false,
    index: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn(sans.variable, mono.variable)} lang="en">
      <body>
        <EvlogProvider
          console={process.env.NODE_ENV !== "production"}
          minLevel="info"
          service="eve-single-user-agent-starter:browser"
          transport={clientLogTransport}
        >
          <TooltipProvider>{children}</TooltipProvider>
        </EvlogProvider>
      </body>
    </html>
  );
}
