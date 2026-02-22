"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function TestGenerateClient() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [prompt, setPrompt] = useState("A simple todo app with a list and add button");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modifyMessage, setModifyMessage] = useState("");

  const createSession = useMutation(api.sessions.create);
  const session = useQuery(
    api.sessions.get,
    sessionId ? { id: sessionId } : "skip"
  );
  const files = useQuery(
    api.files.listPaths,
    sessionId ? { sessionId } : "skip"
  );

  const generate = useAction(api.generate.generate);
  const modify = useAction(api.generate.modify);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
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

  const handleGenerate = async () => {
    if (!sessionId || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      addLog(`Starting generation with prompt: "${prompt.substring(0, 50)}..."`);
      addLog("Running Architecture Agent...");

      const result = await generate({ sessionId, prompt });

      if (result.success) {
        addLog(`Generation complete! App: ${result.appName}`);
        addLog(`Files created: ${result.filesCreated}`);
        if (result.previewUrl) {
          setPreviewUrl(result.previewUrl);
          addLog(`Preview URL: ${result.previewUrl}`);
        }
        if (result.error) {
          addLog(`Warning: ${result.error}`);
        }
      } else {
        addLog(`Generation failed: ${result.error}`);
        setError(result.error ?? "Unknown error");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate app";
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleModify = async () => {
    if (!sessionId || !modifyMessage.trim()) return;
    setLoading(true);
    setError(null);
    try {
      addLog(`Modifying app: "${modifyMessage.substring(0, 50)}..."`);
      addLog("Running Chat Agent...");

      const result = await modify({ sessionId, message: modifyMessage });

      if (result.success) {
        addLog(`Modification complete!`);
        addLog(`Files changed: ${result.filesChanged?.join(", ") || "none"}`);
        if (result.response) {
          addLog(`Agent response: ${result.response.substring(0, 100)}...`);
        }
        if (result.error) {
          addLog(`Warning: ${result.error}`);
        }
        setModifyMessage("");
      } else {
        addLog(`Modification failed: ${result.error}`);
        setError(result.error ?? "Unknown error");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to modify app";
      setError(message);
      addLog(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Agent System Test</h1>
        <p className="text-gray-400 mb-8">
          Test the three-agent generation system: Architecture → Coder → Chat
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Session */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Session</h2>
          <button
            onClick={handleCreateSession}
            disabled={loading || !!sessionId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium"
          >
            {sessionId ? "Session Created ✓" : "Create Session"}
          </button>
          {session && (
            <div className="mt-4 text-sm text-gray-400">
              <p>ID: {session._id}</p>
              <p>Status: {session.status}</p>
              {session.appName && <p>App Name: {session.appName}</p>}
            </div>
          )}
        </div>

        {/* Step 2: Generate */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Generate App</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={!sessionId || loading}
            className="w-full bg-gray-700 text-white p-4 rounded mb-4 h-32 resize-none disabled:opacity-50"
            placeholder="Describe the app you want to build..."
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !sessionId || !prompt.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium"
          >
            {loading ? "Generating..." : "Generate App"}
          </button>
        </div>

        {/* Step 3: Modify (optional) */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Step 3: Modify (Optional)
          </h2>
          <textarea
            value={modifyMessage}
            onChange={(e) => setModifyMessage(e.target.value)}
            disabled={!sessionId || !previewUrl || loading}
            className="w-full bg-gray-700 text-white p-4 rounded mb-4 h-24 resize-none disabled:opacity-50"
            placeholder="Describe the changes you want to make..."
          />
          <button
            onClick={handleModify}
            disabled={loading || !sessionId || !previewUrl || !modifyMessage.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium"
          >
            {loading ? "Modifying..." : "Modify App"}
          </button>
        </div>

        {/* Preview and Files */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Preview */}
          {previewUrl && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
              <p className="text-sm text-gray-400 mb-4">
                URL:{" "}
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {previewUrl}
                </a>
              </p>
              <div className="border border-gray-600 rounded overflow-hidden">
                <iframe
                  src={previewUrl}
                  className="w-full h-80 bg-white"
                  title="App Preview"
                />
              </div>
            </div>
          )}

          {/* Files */}
          {files && files.length > 0 && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">
                Generated Files ({files.length})
              </h2>
              <div className="bg-black/50 p-4 rounded font-mono text-sm max-h-80 overflow-y-auto">
                {files.map((file, i) => (
                  <p key={i} className="text-cyan-400">
                    {file}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black/50 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">
                No logs yet. Create a session and generate an app.
              </p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-green-400">
                  {log}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
