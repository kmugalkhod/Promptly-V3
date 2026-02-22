"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function TestSandboxClient() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const createSession = useMutation(api.sessions.create);
  const session = useQuery(
    api.sessions.get,
    sessionId ? { id: sessionId } : "skip"
  );

  const createSandbox = useAction(api.sandbox.create);
  const writeFile = useAction(api.sandbox.writeFile);
  const checkStatus = useAction(api.sandbox.checkStatus);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleCreateSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await createSession();
      setSessionId(id);
      addLog(`Session created: ${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSandbox = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      addLog("Creating E2B sandbox...");
      const result = await createSandbox({ sessionId });
      setSandboxId(result.sandboxId);
      setPreviewUrl(result.previewUrl);
      addLog(`Sandbox created: ${result.sandboxId}`);
      addLog(`Preview URL: ${result.previewUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create sandbox";
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWriteTestFile = async () => {
    if (!sessionId || !sandboxId) return;
    setLoading(true);
    setError(null);
    try {
      addLog("Writing test page.tsx...");
      const testContent = `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold text-blue-600">
        Hello from Promptly!
      </h1>
      <p className="mt-4 text-gray-600">
        E2B sandbox is working with hot reload.
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Generated at: ${new Date().toISOString()}
      </p>
    </main>
  );
}`;

      const result = await writeFile({
        sessionId,
        sandboxId,
        path: "app/page.tsx",
        content: testContent,
      });

      if (result.success) {
        addLog("File written successfully - hot reload triggered!");
      } else {
        addLog(`Write failed: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to write file";
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!sandboxId || !sessionId) return;
    setLoading(true);
    try {
      addLog("Checking sandbox status...");
      const result = await checkStatus({ sessionId, sandboxId });
      if (result.alive) {
        addLog("Sandbox is alive and responsive");
      } else {
        addLog(`Sandbox not responding: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Status check failed";
      addLog(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">E2B Sandbox Test</h1>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Session</h2>
            <button
              onClick={handleCreateSession}
              disabled={loading || !!sessionId}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium"
            >
              {sessionId ? "Session Created ✓" : "1. Create Session"}
            </button>
            {session && (
              <div className="mt-4 text-sm text-gray-400">
                <p>ID: {session._id}</p>
                <p>Status: {session.status}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Sandbox</h2>
            <button
              onClick={handleCreateSandbox}
              disabled={loading || !sessionId || !!sandboxId}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium mb-2"
            >
              {sandboxId ? "Sandbox Created ✓" : "2. Create Sandbox"}
            </button>
            <button
              onClick={handleCheckStatus}
              disabled={loading || !sandboxId}
              className="w-full bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 px-4 py-2 rounded font-medium"
            >
              Check Status
            </button>
            {sandboxId && (
              <div className="mt-4 text-sm text-gray-400">
                <p>Sandbox ID: {sandboxId.substring(0, 20)}...</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Hot Reload</h2>
          <button
            onClick={handleWriteTestFile}
            disabled={loading || !sandboxId}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium"
          >
            3. Write Test File (app/page.tsx)
          </button>
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            <p className="text-sm text-gray-400 mb-4">
              URL: <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{previewUrl}</a>
            </p>
            <div className="border border-gray-600 rounded overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-96 bg-white"
                title="Sandbox Preview"
              />
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black/50 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Create a session to start.</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-green-400">{log}</p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
