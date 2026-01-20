"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Copy, Check, Download, Loader2 } from "lucide-react";
import { getLanguageFromPath } from "@/lib/utils/language-map";

interface CodeEditorProps {
  code: string;
  fileName?: string;
  language?: string;
  onChange?: (value: string) => void;
}

export function CodeEditor({
  code,
  fileName = "index.html",
  language,
  onChange,
}: CodeEditorProps) {
  // Auto-detect language from fileName if not explicitly provided
  const detectedLanguage = language || getLanguageFromPath(fileName);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900">
      {/* Editor Toolbar */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">{fileName}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage={detectedLanguage}
          value={code}
          onChange={(value) => onChange?.(value || "")}
          theme="vs-dark"
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 16 },
            readOnly: !onChange,
          }}
        />
      </div>
    </div>
  );
}
