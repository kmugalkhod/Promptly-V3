"use client";

import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled,
  placeholder = "Describe what you want to build...",
}: MessageInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-zinc-800">
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={disabled}
          className="w-full px-4 py-3 pr-12 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="absolute right-3 bottom-3 p-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          aria-label="Send message"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
      <p className="text-xs text-zinc-600 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
