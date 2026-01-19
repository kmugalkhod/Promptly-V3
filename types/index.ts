// These types will be fully typed once `npx convex dev` generates the dataModel
// For now, we define the shape manually based on our schema

// Session with computed counts (from getWithCounts)
export type SessionWithCounts = {
  _id: string;
  _creationTime: number;
  appName?: string;
  previewUrl?: string;
  architecture?: string;
  status: "new" | "active" | "archived";
  createdAt: number;
  messageCount: number;
  fileCount: number;
};

// Message role type
export type MessageRole = "user" | "assistant";

// Session status type
export type SessionStatus = "new" | "active" | "archived";

// File tree node (for file explorer)
export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
};

// Utility to build file tree from flat list of paths
export function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const path of paths) {
    const parts = path.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((node) => node.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        currentLevel.push(existing);
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  return root;
}
