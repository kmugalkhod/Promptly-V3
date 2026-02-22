"use client";

import { useState, useCallback, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  getAuthorizationUrl,
  getRedirectUri,
} from "@/lib/supabase/oauth";

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

interface SupabaseProject {
  ref: string;
  name: string;
  region: string;
}

export function useSupabaseOAuth(sessionId: Id<"sessions">) {
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [selectedProjectRef, setSelectedProjectRef] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connectSupabase = useAction(api.sessions.connectSupabase);

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

      let parsed: { state: string; codeVerifier: string; redirectUri: string };
      try {
        parsed = JSON.parse(stored);
      } catch {
        setError("Corrupted OAuth state. Please try again.");
        setFlowState("idle");
        localStorage.removeItem("supabase_oauth_state");
        return;
      }
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
          fetch("/api/auth/supabase/projects", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          }),
          fetch("/api/auth/supabase/organizations", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          }),
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

  // Confirm project selection
  const handleSelectProject = useCallback(async () => {
    if (!selectedProjectRef || !accessToken) return;

    setFlowState("connecting");
    setError(null);

    try {
      const res = await fetch(
        `/api/auth/supabase/projects?projectRef=${encodeURIComponent(selectedProjectRef)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to fetch project keys");
        setFlowState("selecting-project");
        return;
      }

      const { supabaseUrl: projUrl, supabaseAnonKey: projKey } = await res.json();

      // Test query validation
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

      await connectSupabase({
        sessionId,
        supabaseUrl: projUrl,
        supabaseAnonKey: projKey,
        supabaseProjectRef: selectedProjectRef,
        accessToken: accessToken!,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresIn ? { expiresIn } : {}),
      });

      setFlowState("idle");
      setProjects([]);
      setAccessToken(null);
      setRefreshToken(null);
      setExpiresIn(null);
      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setFlowState("selecting-project");
      return { success: false };
    }
  }, [selectedProjectRef, accessToken, refreshToken, expiresIn, sessionId, connectSupabase]);

  // Disconnect
  const handleDisconnect = useCallback(async () => {
    // Returns a promise; caller handles isSaving state
  }, []);

  const isLoading =
    flowState === "authorizing" ||
    flowState === "exchanging" ||
    flowState === "connecting" ||
    flowState === "creating-project-wait";

  return {
    flowState,
    setFlowState,
    projects,
    setProjects,
    selectedProjectRef,
    setSelectedProjectRef,
    accessToken,
    setAccessToken,
    refreshToken,
    setRefreshToken,
    expiresIn,
    setExpiresIn,
    organizations,
    setOrganizations,
    error,
    setError,
    isLoading,
    handleOAuthConnect,
    handleSelectProject,
  };
}
