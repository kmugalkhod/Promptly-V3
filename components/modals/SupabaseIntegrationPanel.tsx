"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Database,
  Loader2,
  ChevronDown,
  Plus,
} from "lucide-react";
import { useSupabaseOAuth } from "@/hooks/useSupabaseOAuth";
import { ManualConnectionForm } from "./ManualConnectionForm";
import { ProjectCreationForm } from "./ProjectCreationForm";

interface SupabaseIntegrationPanelProps {
  sessionId: Id<"sessions">;
  supabaseUrl: string | null;
  supabaseConnected: boolean;
  onBack: () => void;
}

export function SupabaseIntegrationPanel({
  sessionId,
  supabaseUrl,
  supabaseConnected,
  onBack,
}: SupabaseIntegrationPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const updateSession = useMutation(api.sessions.update);
  const disconnectSupabase = useAction(api.sessions.disconnectSupabase);

  const {
    flowState,
    setFlowState,
    projects,
    setProjects,
    selectedProjectRef,
    setSelectedProjectRef,
    accessToken,
    setAccessToken,
    refreshToken,
    expiresIn,
    organizations,
    error,
    setError,
    isLoading,
    handleOAuthConnect,
    handleSelectProject,
  } = useSupabaseOAuth(sessionId);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // Wrap handleSelectProject to show toast on success
  const handleSelectProjectWithToast = useCallback(async () => {
    const result = await handleSelectProject();
    if (result?.success) {
      showToast("Supabase connected successfully!", "success");
    }
  }, [handleSelectProject, showToast]);

  // Manual connect handler
  const handleManualConnect = useCallback(async (url: string, anonKey: string) => {
    await updateSession({
      id: sessionId,
      supabaseUrl: url,
      supabaseAnonKey: anonKey,
      supabaseConnected: true,
    });
    setFlowState("idle");
    showToast("Supabase connected successfully!", "success");
  }, [sessionId, updateSession, setFlowState, showToast]);

  // Disconnect handler
  const handleDisconnect = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      await disconnectSupabase({ sessionId });
      showToast("Supabase disconnected", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, sessionId, disconnectSupabase, setError, showToast]);

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            toast.type === "success"
              ? "bg-green-900/30 border border-green-800/50 text-green-300"
              : "bg-red-900/30 border border-red-800/50 text-red-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
          <Database className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-white font-medium">Supabase</h3>
          <p className="text-xs text-zinc-500">PostgreSQL database</p>
        </div>
        <span
          className={`ml-auto px-2 py-0.5 rounded text-xs ${
            supabaseConnected
              ? "bg-green-900/50 text-green-400"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {supabaseConnected ? "Connected" : "Not Connected"}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {supabaseConnected ? (
        /* Connected state */
        <div>
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Project URL</span>
              <span className="text-white font-mono text-xs">
                {supabaseUrl}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Status</span>
              <span className="text-green-400">Active</span>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={isSaving}
            className="w-full py-2.5 rounded-lg font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              "Disconnect"
            )}
          </button>
        </div>
      ) : flowState === "selecting-project" ? (
        /* Project selection state */
        <div>
          {projects.length > 0 ? (
            <>
              <p className="text-sm text-zinc-400 mb-3">
                Select a Supabase project to connect:
              </p>
              <div className="relative mb-4">
                <select
                  value={selectedProjectRef}
                  onChange={(e) => setSelectedProjectRef(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {projects.map((project) => (
                    <option key={project.ref} value={project.ref}>
                      {project.name} ({project.region})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={handleSelectProjectWithToast}
                disabled={!selectedProjectRef}
                className="w-full py-2.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
              >
                Connect Project
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-400 mb-3">
              No existing projects found.
            </p>
          )}

          {organizations.length > 0 && (
            <button
              onClick={() => setFlowState("creating-project")}
              className="w-full mt-3 py-2.5 rounded-lg font-medium border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Project
            </button>
          )}

          <button
            onClick={() => {
              setFlowState("idle");
              setProjects([]);
              setAccessToken(null);
            }}
            className="w-full mt-2 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : flowState === "creating-project" || flowState === "creating-project-wait" ? (
        /* Create project form */
        accessToken && organizations.length > 0 ? (
          <ProjectCreationForm
            organizations={organizations}
            accessToken={accessToken}
            refreshToken={refreshToken}
            expiresIn={expiresIn}
            sessionId={sessionId}
            onSuccess={() => {
              setFlowState("idle");
              setProjects([]);
              setAccessToken(null);
            }}
            onBack={() => setFlowState("selecting-project")}
            onError={(err) => setError(err)}
            showToast={showToast}
          />
        ) : null
      ) : flowState === "manual" ? (
        /* Manual connection form */
        <ManualConnectionForm
          onConnect={handleManualConnect}
          onBack={() => setFlowState("idle")}
          isLoading={isLoading}
        />
      ) : (
        /* Default disconnected state — OAuth primary, manual fallback */
        <div>
          <button
            onClick={handleOAuthConnect}
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {flowState === "authorizing"
                  ? "Waiting for authorization..."
                  : flowState === "exchanging"
                    ? "Completing setup..."
                    : "Connecting..."}
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Connect with Supabase
              </>
            )}
          </button>

          <div className="mt-3 text-center">
            <button
              onClick={() => setFlowState("manual")}
              disabled={isLoading}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              or connect manually
            </button>
          </div>

          <p className="text-xs text-zinc-600 mt-4 text-center">
            Connect your Supabase account to automatically configure your
            database credentials.
          </p>
        </div>
      )}
    </div>
  );
}
