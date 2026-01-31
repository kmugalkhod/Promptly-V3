"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Settings, Database, ChevronRight } from "lucide-react";
import { SupabaseIntegrationPanel } from "./SupabaseIntegrationPanel";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: Id<"sessions">;
}

type Tab = "general" | "integrations";
type View = "list" | "supabase-detail";

export function SettingsModal({ isOpen, onClose, sessionId }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("integrations");
  const [view, setView] = useState<View>("list");

  // Always call hooks unconditionally (React rules)
  const supabaseStatus = useQuery(api.sessions.getSupabaseStatus, { id: sessionId });

  const handleClose = useCallback(() => {
    setView("list");
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setView("list");
  }, []);

  if (!isOpen) return null;

  const supabaseConnected = supabaseStatus?.supabaseConnected ?? false;
  const supabaseUrl = supabaseStatus?.supabaseUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4 relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-white">Project Settings</h2>
        </div>

        {/* Tabs */}
        {view === "list" && (
          <div className="flex gap-1 mb-5 border-b border-zinc-800 pb-px">
            <button
              onClick={() => handleTabChange("general")}
              className={`px-3 py-2 text-sm rounded-t transition-colors ${
                activeTab === "general"
                  ? "text-white border-b-2 border-violet-500"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              General
            </button>
            <button
              onClick={() => handleTabChange("integrations")}
              className={`px-3 py-2 text-sm rounded-t transition-colors ${
                activeTab === "integrations"
                  ? "text-white border-b-2 border-violet-500"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Integrations
            </button>
          </div>
        )}

        {/* Content */}
        {view === "list" && activeTab === "general" && (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-500">
              Project settings coming soon.
            </p>
          </div>
        )}

        {view === "list" && activeTab === "integrations" && (
          <div>
            {/* Supabase integration card */}
            <button
              onClick={() => setView("supabase-detail")}
              className="w-full p-4 border border-zinc-800 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">Supabase</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        supabaseConnected
                          ? "bg-green-900/50 text-green-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {supabaseConnected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    PostgreSQL database for your app
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
              </div>
            </button>
          </div>
        )}

        {view === "supabase-detail" && (
          <SupabaseIntegrationPanel
            sessionId={sessionId}
            supabaseUrl={supabaseUrl}
            supabaseConnected={supabaseConnected}
            onBack={() => setView("list")}
          />
        )}
      </div>
    </div>
  );
}
