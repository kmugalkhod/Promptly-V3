"use client";

import { useState, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, ChevronDown } from "lucide-react";

const REGIONS = [
  { value: "us-east-1", label: "US East (Virginia)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "eu-west-2", label: "EU West (London)" },
  { value: "eu-central-1", label: "EU Central (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
];

interface SupabaseOrganization {
  id: string;
  name: string;
}

interface ProjectCreationFormProps {
  organizations: SupabaseOrganization[];
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  sessionId: Id<"sessions">;
  onSuccess: () => void;
  onBack: () => void;
  onError: (error: string) => void;
  showToast: (message: string, type: "success" | "error") => void;
}

export function ProjectCreationForm({
  organizations,
  accessToken,
  refreshToken,
  expiresIn,
  sessionId,
  onSuccess,
  onBack,
  onError,
  showToast,
}: ProjectCreationFormProps) {
  const [selectedOrgId, setSelectedOrgId] = useState(organizations[0]?.id ?? "");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("us-east-1");
  const [creationProgress, setCreationProgress] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectSupabase = useAction(api.sessions.connectSupabase);

  const handleCreateProject = useCallback(async () => {
    if (!accessToken || !selectedOrgId || !newProjectName.trim()) return;

    setIsCreating(true);
    setError(null);
    setCreationProgress("Creating your Supabase project...");

    try {
      const dbPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";

      const res = await fetch("/api/auth/supabase/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          org_id: selectedOrgId,
          project_name: newProjectName.trim(),
          region: selectedRegion,
          db_password: dbPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 202) {
        setError(data.error || "Failed to create project");
        setIsCreating(false);
        return;
      }

      if (res.status === 202) {
        onError(data.error);
        onBack();
        return;
      }

      await connectSupabase({
        sessionId,
        supabaseUrl: data.supabaseUrl,
        supabaseAnonKey: data.supabaseAnonKey,
        supabaseProjectRef: data.projectRef,
        accessToken: accessToken!,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresIn ? { expiresIn } : {}),
      });

      setNewProjectName("");
      setCreationProgress("");
      showToast("Supabase project created and connected!", "success");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
    }
  }, [accessToken, refreshToken, expiresIn, selectedOrgId, newProjectName, selectedRegion, sessionId, connectSupabase, onSuccess, onBack, onError, showToast]);

  if (isCreating) {
    return (
      <div className="text-center py-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
        <p className="text-sm text-zinc-300 mb-1">{creationProgress}</p>
        <p className="text-xs text-zinc-500">This usually takes 1-2 minutes</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      <p className="text-sm text-zinc-400 mb-3">
        Create a new Supabase project:
      </p>
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Organization</label>
          <div className="relative">
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Project Name</label>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="my-app"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Region</label>
          <div className="relative">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <button
        onClick={handleCreateProject}
        disabled={!newProjectName.trim() || !selectedOrgId}
        className="w-full py-2.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
      >
        Create Project
      </button>

      <button
        onClick={onBack}
        className="w-full mt-2 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        Back to project list
      </button>
    </div>
  );
}
