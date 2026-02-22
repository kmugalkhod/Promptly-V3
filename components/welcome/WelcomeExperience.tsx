"use client";

import { useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "motion/react";
import { Sparkles, Send, Loader2 } from "lucide-react";

export function WelcomeExperience() {
  const router = useRouter();
  const createSession = useMutation(api.sessions.create);

  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const sessionId = await createSession();
      sessionStorage.setItem("pendingPrompt", input.trim());
      router.push(`/builder/${sessionId}`);
    } catch (err) {
      console.error("Failed to create session:", err);
      setError("Failed to create project. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-zinc-950">
      <motion.div
        className="flex flex-col items-center w-full max-w-2xl px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Branded Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-white mb-2">
          What do you want to build?
        </h1>
        <p className="text-zinc-400 text-center mb-8">
          Describe your app idea and Promptly will generate it for you.
        </p>

        {/* Glassmorphism Input Area */}
        <div
          className="w-full rounded-xl border p-1"
          style={{
            background: "var(--glass-bg)",
            borderColor: "var(--glass-border)",
            backdropFilter: "blur(var(--glass-blur))",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your app idea..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-4 py-3 pr-14 bg-transparent text-sm text-white placeholder-zinc-500 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isSubmitting}
              className="absolute right-3 bottom-3 p-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed rounded-lg transition-all"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>

        {/* Error Display */}
        {error && (
          <p className="text-sm text-red-400 mt-3 text-center">{error}</p>
        )}
      </motion.div>
    </div>
  );
}
