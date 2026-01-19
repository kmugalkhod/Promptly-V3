"use client";

type SandboxStatusType = "loading" | "live" | "offline";

interface SandboxStatusProps {
  status: SandboxStatusType;
}

const statusConfig = {
  loading: {
    color: "bg-yellow-900/50 text-yellow-400",
    dot: "bg-yellow-400",
    label: "Loading",
  },
  live: {
    color: "bg-green-900/50 text-green-400",
    dot: "bg-green-400",
    label: "Live",
  },
  offline: {
    color: "bg-red-900/50 text-red-400",
    dot: "bg-red-400",
    label: "Offline",
  },
};

export function SandboxStatus({ status }: SandboxStatusProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
