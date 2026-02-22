"use client";

import { useState, useMemo, useCallback } from "react";
import { FolderTree } from "lucide-react";
import { FileTreeNode } from "./FileTreeNode";
import { buildFileTree } from "@/types";

interface FileExplorerProps {
  files: { path: string; content: string }[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

// Get initial expanded paths from file tree (top-level folders)
function getInitialExpandedPaths(
  files: { path: string; content: string }[]
): Set<string> {
  if (!files || files.length === 0) return new Set();
  const tree = buildFileTree(files.map((f) => f.path));
  const topLevelFolders = tree
    .filter((node) => node.type === "folder")
    .map((node) => node.path);
  return new Set(topLevelFolders);
}

export function FileExplorer({
  files,
  selectedPath,
  onSelectFile,
}: FileExplorerProps) {
  // Lazy initialization for expanded paths - runs only once
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    getInitialExpandedPaths(files)
  );

  // Sync expanded paths when files change — track previous files via state
  const [prevFiles, setPrevFiles] = useState(files);
  if (files !== prevFiles) {
    setPrevFiles(files);
    if (files && files.length > 0) {
      const tree = buildFileTree(files.map((f) => f.path));
      const topLevelFolders = tree
        .filter((node) => node.type === "folder")
        .map((node) => node.path);
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (const folder of topLevelFolders) {
          next.add(folder);
        }
        return next;
      });
    }
  }

  // Build file tree from flat file list, memoized to avoid recalculation
  const fileTree = useMemo(() => {
    if (!files || files.length === 0) return [];
    return buildFileTree(files.map((f) => f.path));
  }, [files]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className="w-[250px] flex flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Header */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-3 gap-2">
        <FolderTree className="w-4 h-4 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-300">FILES</span>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {fileTree.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-zinc-500">No files generated yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Start chatting to generate code
            </p>
          </div>
        ) : (
          fileTree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelectFile}
              onToggle={handleToggle}
              level={0}
            />
          ))
        )}
      </div>
    </div>
  );
}
