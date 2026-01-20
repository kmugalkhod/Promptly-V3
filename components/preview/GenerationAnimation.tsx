"use client";

import { Sparkles } from "lucide-react";

interface GenerationAnimationProps {
  stage?: string;
}

// Stage descriptions for more context
const stageDescriptions: Record<string, string> = {
  "Creating sandbox...": "Setting up your development environment",
  "Analyzing request...": "Understanding what you want to build",
  "Designing architecture...": "Planning the structure of your app",
  "Writing code...": "Generating your components and logic",
  "Almost ready...": "Finishing up the final touches",
};

export function GenerationAnimation({ stage }: GenerationAnimationProps) {
  const description = stage ? stageDescriptions[stage] || "Building your application" : "Building your application";

  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        {/* Animated gradient circle background */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 animate-pulse" />

          {/* Inner gradient circle */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 animate-gradient" />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-white animate-pulse" />
          </div>

          {/* Floating code symbols */}
          <span
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-violet-400 text-lg font-mono animate-float opacity-60"
            style={{ animationDelay: "0s" }}
          >
            {"</>"}
          </span>
          <span
            className="absolute top-1/2 -right-4 -translate-y-1/2 text-purple-400 text-lg font-mono animate-float opacity-60"
            style={{ animationDelay: "0.5s" }}
          >
            {"{ }"}
          </span>
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-violet-400 text-lg font-mono animate-float opacity-60"
            style={{ animationDelay: "1s" }}
          >
            {"( )"}
          </span>
          <span
            className="absolute top-1/2 -left-4 -translate-y-1/2 text-purple-400 text-lg font-mono animate-float opacity-60"
            style={{ animationDelay: "1.5s" }}
          >
            {"[ ]"}
          </span>
        </div>

        {/* Stage text */}
        <p className="text-lg font-medium text-white mb-2">
          {stage || "Generating your app..."}
        </p>

        {/* Description text */}
        <p className="text-sm text-zinc-400 max-w-xs mx-auto">
          {description}
        </p>

        {/* Animated dots */}
        <div className="flex justify-center gap-1 mt-6">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: "0.2s" }} />
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}
