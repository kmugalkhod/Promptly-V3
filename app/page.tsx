"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Plus, ChevronRight, MessageSquare, Clock, Trash2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function Home() {
  const router = useRouter();
  const sessions = useQuery(api.sessions.list);
  const createSession = useMutation(api.sessions.create);
  const removeSession = useMutation(api.sessions.remove);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<Id<"sessions"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteSessionId) return;
    setIsDeleting(true);
    try {
      await removeSession({ id: deleteSessionId });
      setDeleteSessionId(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const sessionId = await createSession();
      // Redirect to the builder page after creating a session
      router.push(`/builder/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Promptly</h1>
              <p className="text-sm text-zinc-400">AI App Builder</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Build apps with AI
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto mb-8">
            Describe what you want to build, and watch your app come to life in real-time.
          </p>
          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            {isCreating ? "Creating..." : "New Project"}
          </button>
        </div>

        {/* Sessions List */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-zinc-300">
            Your Projects
          </h3>

          {sessions === undefined ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 border border-zinc-800 rounded-xl bg-zinc-900/50">
              <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">
                No projects yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link
                  key={session._id}
                  href={`/builder/${session._id}`}
                  className="block p-4 border border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">
                        {session.appName || "Untitled Project"}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          session.status === "active"
                            ? "bg-green-900/50 text-green-400"
                            : session.status === "archived"
                            ? "bg-zinc-800 text-zinc-500"
                            : "bg-violet-900/50 text-violet-400"
                        }`}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteSessionId(session._id);
                        }}
                        className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-400" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteSessionId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Project?</h3>
            <p className="text-zinc-400 mb-6">
              This will permanently delete the project and all its files. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteSessionId(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-white transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
