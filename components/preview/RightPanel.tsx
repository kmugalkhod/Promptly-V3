"use client";

import { useState } from "react";
import { Eye, Code } from "lucide-react";
import { Preview } from "./Preview";
import { CodeEditor } from "./CodeEditor";
import { FileExplorer } from "../explorer";

interface RightPanelProps {
  previewUrl?: string;
  code?: string;
  fileName?: string;
  onRetry?: () => void;
  selectedFile?: { path: string; content: string } | null;
  files?: { path: string; content: string }[];
  selectedPath?: string | null;
  onSelectFile?: (path: string) => void;
  isGenerating?: boolean;
  generationStage?: string;
  sandboxStatus?: "idle" | "initializing" | "ready" | "error";  // renamed to sandboxInitStatus in Preview
}

type ActiveTab = "preview" | "code";

export function RightPanel({
  previewUrl,
  code,
  fileName,
  onRetry,
  selectedFile,
  files,
  selectedPath,
  onSelectFile,
  isGenerating,
  generationStage,
  sandboxStatus,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("preview");

  // Prioritize selectedFile over code/fileName props (backwards compatible)
  const displayCode = selectedFile?.content ?? code;
  const displayFileName = selectedFile?.path ?? fileName;

  const defaultCode = `<!-- Your generated code will appear here -->
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <h1>Hello, World!</h1>
  </body>
</html>`;

  return (
    <div className="flex-1 flex flex-col bg-zinc-950">
      {/* Tab Bar */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-2 gap-1">
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            activeTab === "preview"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }`}
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
            activeTab === "code"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }`}
        >
          <Code className="w-4 h-4" />
          Code
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" ? (
          <Preview
            previewUrl={previewUrl}
            code={code}
            onRetry={onRetry}
            isGenerating={isGenerating}
            generationStage={generationStage}
            sandboxInitStatus={sandboxStatus}
          />
        ) : (
          <div className="flex-1 flex h-full">
            <FileExplorer
              files={files || []}
              selectedPath={selectedPath ?? null}
              onSelectFile={onSelectFile || (() => {})}
            />
            <CodeEditor
              code={displayCode || defaultCode}
              fileName={displayFileName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
