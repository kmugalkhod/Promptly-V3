"use client";

import { useState, useCallback } from "react";
import { Loader2, ExternalLink } from "lucide-react";

interface ManualConnectionFormProps {
  onConnect: (url: string, anonKey: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export function ManualConnectionForm({ onConnect, onBack, isLoading }: ManualConnectionFormProps) {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidUrl = (value: string) => {
    return /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(value.trim());
  };

  const canConnect =
    url.trim().length > 0 && anonKey.trim().length > 0 && isValidUrl(url);

  const handleManualConnect = useCallback(async () => {
    if (!canConnect || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const cleanUrl = url.trim().replace(/\/$/, "");
      const cleanKey = anonKey.trim();

      // Test query validation
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

      await onConnect(cleanUrl, cleanKey);
      setUrl("");
      setAnonKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsSaving(false);
    }
  }, [canConnect, isSaving, url, anonKey, onConnect]);

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

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
        disabled={!canConnect || isSaving || isLoading}
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
        onClick={onBack}
        className="w-full mt-2 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        Back
      </button>
    </div>
  );
}
