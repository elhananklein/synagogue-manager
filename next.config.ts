import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// `next build` writes to `.next`. If `next dev` uses the same folder, a concurrent
// build (or wiping `.next`) can remove `routes-manifest.json` and every route returns 500.
// Dev uses its own output directory so production builds cannot clobber the dev server.
export default function createNextConfig(phase: string): NextConfig {
  return {
    reactStrictMode: true,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  };
}
