"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  Database,
  Loader2,
  ExternalLink,
  ChevronDown,
  Plus,
} from "lucide-react";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  getAuthorizationUrl,
  getRedirectUri,
} from "@/lib/supabase/oauth";

interface SupabaseIntegrationPanelProps {
  sessionId: Id<"sessions">;
  supabaseUrl: string | null;
  supabaseConnected: boolean;
  onBack: () => void;
}

type FlowState =
  | "idle"
  | "authorizing"
  | "exchanging"
  | "selecting-project"
  | "connecting"
  | "manual"
  | "creating-project"
  | "creating-project-wait";

interface SupabaseOrganization {
  id: string;
  name: string;
}

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

interface SupabaseProject {
  ref: string;
  name: string;
  region: string;
}

export function SupabaseIntegrationPanel({
  sessionId,
  supabaseUrl,
  supabaseConnected,
  onBack,
}: SupabaseIntegrationPanelProps) {
  // Manual form state
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // OAuth flow state
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [selectedProjectRef, setSelectedProjectRef] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  // Create project state
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("us-east-1");
  const [creationProgress, setCreationProgress] = useState("");

  // Only mutation we need — the existing one
  const updateSession = useMutation(api.sessions.update);

  const isValidUrl = (value: string) => {
    return /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(value.trim());
  };

  const canConnect =
    url.trim().length > 0 && anonKey.trim().length > 0 && isValidUrl(url);

  // Listen for OAuth callback postMessage
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "supabase-oauth-callback") return;

      const { code, state, error: oauthError, errorDescription } = event.data;

      if (oauthError) {
        setError(errorDescription || oauthError || "Authorization denied");
        setFlowState("idle");
        return;
      }

      if (!code) {
        setError("No authorization code received");
        setFlowState("idle");
        return;
      }

      // Verify state matches
      const stored = localStorage.getItem("supabase_oauth_state");
      if (!stored) {
        setError("OAuth state not found. Please try again.");
        setFlowState("idle");
        return;
      }

      const parsed = JSON.parse(stored);
      if (parsed.state !== state) {
        setError("OAuth state mismatch. Please try again.");
        setFlowState("idle");
        localStorage.removeItem("supabase_oauth_state");
        return;
      }

      // Exchange code for tokens via Next.js API route
      setFlowState("exchanging");
      setError(null);

      try {
        const tokenRes = await fetch("/api/auth/supabase/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            codeVerifier: parsed.codeVerifier,
            redirectUri: getRedirectUri(),
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json();
          setError(err.error || "Token exchange failed");
          setFlowState("idle");
          return;
        }

        const tokenData = await tokenRes.json();
        setAccessToken(tokenData.access_token);
        setRefreshToken(tokenData.refresh_token ?? null);
        setExpiresIn(tokenData.expires_in ?? null);

        // Fetch projects and organizations in parallel
        setFlowState("selecting-project");
        const [projectsRes, orgsRes] = await Promise.all([
          fetch(`/api/auth/supabase/projects?access_token=${encodeURIComponent(tokenData.access_token)}`),
          fetch(`/api/auth/supabase/organizations?access_token=${encodeURIComponent(tokenData.access_token)}`),
        ]);

        if (!projectsRes.ok) {
          const err = await projectsRes.json();
          setError(err.error || "Failed to fetch projects");
          setFlowState("idle");
          return;
        }

        const projectsData = await projectsRes.json();

        // Store orgs for create-project flow
        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          if (orgsData.organizations?.length > 0) {
            setOrganizations(orgsData.organizations);
            setSelectedOrgId(orgsData.organizations[0].id);
          }
        }

        // Allow empty projects — user can create one
        setProjects(projectsData.projects ?? []);
        if (projectsData.projects?.length > 0) {
          setSelectedProjectRef(projectsData.projects[0].ref);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "OAuth flow failed");
        setFlowState("idle");
      } finally {
        localStorage.removeItem("supabase_oauth_state");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Start OAuth flow
  const handleOAuthConnect = useCallback(async () => {
    setError(null);

    const clientId = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_CLIENT_ID;
    if (!clientId) {
      setError("OAuth is not configured. Please use manual connection.");
      return;
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();
    const redirectUri = getRedirectUri();

    localStorage.setItem(
      "supabase_oauth_state",
      JSON.stringify({ codeVerifier, state })
    );

    const authUrl = getAuthorizationUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
    });

    const popup = window.open(
      authUrl,
      "supabase-oauth",
      "width=600,height=700,popup=yes"
    );

    if (!popup) {
      setError(
        "Popup was blocked. Please allow popups for this site and try again."
      );
      localStorage.removeItem("supabase_oauth_state");
      return;
    }

    setFlowState("authorizing");

    // Detect if popup closed without completing
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        setFlowState((prev) => (prev === "authorizing" ? "idle" : prev));
      }
    }, 1000);
  }, []);

  // Confirm project selection — fetches keys via API route, stores in Convex via existing mutation
  const handleSelectProject = useCallback(async () => {
    if (!selectedProjectRef || !accessToken) return;

    setFlowState("connecting");
    setError(null);

    try {
      // Fetch API keys for selected project via Next.js API route
      const res = await fetch(
        `/api/auth/supabase/projects?access_token=${encodeURIComponent(accessToken)}&projectRef=${encodeURIComponent(selectedProjectRef)}`
      );

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to fetch project keys");
        setFlowState("selecting-project");
        return;
      }

      const { supabaseUrl: projUrl, supabaseAnonKey: projKey } = await res.json();

      // Test query validation — verify credentials work
      try {
        const testRes = await fetch(`${projUrl}/rest/v1/`, {
          headers: {
            apikey: projKey,
            Authorization: `Bearer ${projKey}`,
          },
        });
        if (!testRes.ok) {
          setError("Connection test failed. Please check your Supabase project is active.");
          setFlowState("selecting-project");
          return;
        }
      } catch {
        setError("Connection test failed. Could not reach the Supabase project.");
        setFlowState("selecting-project");
        return;
      }

      // Store credentials + access token + refresh token
      await updateSession({
        id: sessionId,
        supabaseUrl: projUrl,
        supabaseAnonKey: projKey,
        supabaseConnected: true,
        supabaseAccessToken: accessToken,
        supabaseProjectRef: selectedProjectRef,
        ...(refreshToken ? { supabaseRefreshToken: refreshToken } : {}),
        ...(expiresIn ? { supabaseTokenExpiry: Date.now() + expiresIn * 1000 } : {}),
      });

      setFlowState("idle");
      setProjects([]);
      setAccessToken(null);
      setRefreshToken(null);
      setExpiresIn(null);
      setToast({ message: "Supabase connected successfully!", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setFlowState("selecting-project");
    }
  }, [selectedProjectRef, accessToken, refreshToken, expiresIn, sessionId, updateSession]);

  // Manual connect (existing flow, unchanged)
  const handleManualConnect = useCallback(async () => {
    if (!canConnect || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const cleanUrl = url.trim().replace(/\/$/, "");
      const cleanKey = anonKey.trim();

      // Test query validation — verify credentials work
      try {
        const testRes = await fetch(`${cleanUrl}/rest/v1/`, {
          headers: {
            apikey: cleanKey,
            Authorization: `Bearer ${cleanKey}`,
          },
        });
        if (!testRes.ok) {
          setError("Connection test failed. Please check your URL and anon key.");
          setIsSaving(false);
          return;
        }
      } catch {
        setError("Connection test failed. Could not reach the Supabase project.");
        setIsSaving(false);
        return;
      }

      await updateSession({
        id: sessionId,
        supabaseUrl: cleanUrl,
        supabaseAnonKey: cleanKey,
        supabaseConnected: true,
      });
      setUrl("");
      setAnonKey("");
      setFlowState("idle");
      setToast({ message: "Supabase connected successfully!", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsSaving(false);
    }
  }, [canConnect, isSaving, url, anonKey, sessionId, updateSession]);

  // Create a new Supabase project
  const handleCreateProject = useCallback(async () => {
    if (!accessToken || !selectedOrgId || !newProjectName.trim()) return;

    setFlowState("creating-project-wait");
    setError(null);
    setCreationProgress("Creating your Supabase project...");

    try {
      // Generate a random DB password
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
        setFlowState("creating-project");
        return;
      }

      if (res.status === 202) {
        // Project created but not ready — still usable
        setError(data.error);
        setFlowState("selecting-project");
        return;
      }

      // Success — store all credentials including refresh token
      await updateSession({
        id: sessionId,
        supabaseUrl: data.supabaseUrl,
        supabaseAnonKey: data.supabaseAnonKey,
        supabaseConnected: true,
        supabaseAccessToken: accessToken,
        supabaseProjectRef: data.projectRef,
        ...(refreshToken ? { supabaseRefreshToken: refreshToken } : {}),
        ...(expiresIn ? { supabaseTokenExpiry: Date.now() + expiresIn * 1000 } : {}),
      });

      setFlowState("idle");
      setProjects([]);
      setOrganizations([]);
      setAccessToken(null);
      setRefreshToken(null);
      setExpiresIn(null);
      setNewProjectName("");
      setCreationProgress("");
      setToast({ message: "Supabase project created and connected!", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setFlowState("creating-project");
    }
  }, [accessToken, refreshToken, expiresIn, selectedOrgId, newProjectName, selectedRegion, sessionId, updateSession]);

  // Disconnect (existing flow, unchanged)
  const handleDisconnect = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateSession({
        id: sessionId,
        supabaseUrl: "",
        supabaseAnonKey: "",
        supabaseConnected: false,
        supabaseAccessToken: "",
        supabaseProjectRef: "",
        supabaseRefreshToken: "",
      });
      setToast({ message: "Supabase disconnected", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, sessionId, updateSession]);

  const isLoading =
    flowState === "authorizing" ||
    flowState === "exchanging" ||
    flowState === "connecting" ||
    flowState === "creating-project-wait";

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
                onClick={handleSelectProject}
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
      ) : flowState === "creating-project" ? (
        /* Create project form */
        <div>
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
            onClick={() => setFlowState("selecting-project")}
            className="w-full mt-2 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Back to project list
          </button>
        </div>
      ) : flowState === "creating-project-wait" ? (
        /* Creation progress */
        <div className="text-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 mb-1">{creationProgress}</p>
          <p className="text-xs text-zinc-500">This usually takes 1-2 minutes</p>
        </div>
      ) : flowState === "manual" ? (
        /* Manual connection form */
        <div>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">
                Project URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxxx.supabase.co"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {url.length > 0 && !isValidUrl(url) && (
                <p className="text-xs text-red-400 mt-1">
                  URL must be https://xxxxx.supabase.co
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">
                Anon Public Key
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500 mb-4">
            Found in Supabase Dashboard &gt; Settings &gt; API.{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-0.5"
            >
              Don&apos;t have a project?
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          <button
            onClick={handleManualConnect}
            disabled={!canConnect || isSaving}
            className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              canConnect && !isSaving
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Supabase"
            )}
          </button>

          <button
            onClick={() => setFlowState("idle")}
            className="w-full mt-2 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            Back
          </button>
        </div>
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
