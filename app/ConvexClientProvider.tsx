"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Create client outside component to avoid recreating on re-render
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to configure."
  );
}
const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
