"use client";

import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  FileType,
} from "lucide-react";
import { FileTreeNode as FileTreeNodeType } from "@/types";

interface FileTreeNodeProps {
  node: FileTreeNodeType;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  level: number;
}

// Render the appropriate icon based on file type
function FileIconComponent({
  isFolder,
  isExpanded,
  fileName,
}: {
  isFolder: boolean;
  isExpanded: boolean;
  fileName: string;
}) {
  if (isFolder) {
    return isExpanded ? (
      <FolderOpen className="w-4 h-4 shrink-0 text-yellow-500" />
    ) : (
      <Folder className="w-4 h-4 shrink-0 text-yellow-500" />
    );
  }

  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className="w-4 h-4 shrink-0 text-zinc-500" />;
    case "json":
      return <FileJson className="w-4 h-4 shrink-0 text-zinc-500" />;
    case "md":
    case "mdx":
      return <FileType className="w-4 h-4 shrink-0 text-zinc-500" />;
    case "css":
    case "scss":
    case "html":
      return <FileText className="w-4 h-4 shrink-0 text-zinc-500" />;
    default:
      return <File className="w-4 h-4 shrink-0 text-zinc-500" />;
  }
}

export function FileTreeNode({
  node,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
  level,
}: FileTreeNodeProps) {
  const isFolder = node.type === "folder";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (isFolder) {
      onToggle(node.path);
    } else {
      onSelect(node.path);
    }
  };

  // Compute indent padding - 16px per level
  const paddingLeft = level * 16;

  return (
    <div>
      <button
        onClick={handleClick}
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
        className={`w-full flex items-center gap-1.5 py-1 pr-2 text-sm transition-colors ${
          isSelected
            ? "bg-zinc-800 text-white"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
        }`}
      >
        {/* Chevron for folders */}
        {isFolder ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* File/Folder icon */}
        <FileIconComponent
          isFolder={isFolder}
          isExpanded={isExpanded}
          fileName={node.name}
        />

        {/* Name with truncation */}
        <span className="truncate">{node.name}</span>
      </button>

      {/* Render children if folder is expanded */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
