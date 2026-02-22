"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Sparkles, Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const sessions = useQuery(api.sessions.list);
  const createSession = useMutation(api.sessions.create);
  const removeSession = useMutation(api.sessions.remove);

  const [isCreating, setIsCreating] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<Id<"sessions"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract current sessionId from pathname like /builder/abc123
  const currentSessionId = pathname?.startsWith("/builder/")
    ? pathname.split("/")[2]
    : null;

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const sessionId = await createSession();
      router.push(`/builder/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSessionId) return;
    setIsDeleting(true);
    try {
      await removeSession({ id: deleteSessionId });
      // If we deleted the currently active project, navigate to /builder
      if (currentSessionId === String(deleteSessionId)) {
        router.push("/builder");
      }
      setDeleteSessionId(null);
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Header - Logo */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Promptly">
                <Link href="/builder">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-lg text-white">PROMPTLY</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        {/* Content - Project List */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupAction title="New Project" onClick={handleCreateSession}>
              <Plus />
              <span className="sr-only">New Project</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Loading state */}
                {sessions === undefined && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  </>
                )}

                {/* Empty state */}
                {sessions !== undefined && sessions.length === 0 && (
                  <li className="px-2 py-4 text-center text-xs text-zinc-500">
                    No projects yet
                  </li>
                )}

                {/* Session list */}
                {sessions?.map((session) => (
                  <SidebarMenuItem key={session._id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentSessionId === session._id}
                      tooltip={session.appName || "Untitled Project"}
                    >
                      <Link href={`/builder/${session._id}`}>
                        <MessageSquare className="shrink-0" />
                        <span>{session.appName || "Untitled Project"}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteSessionId(session._id);
                      }}
                      title="Delete project"
                    >
                      <Trash2 />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer - New Project Button */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleCreateSession}
                disabled={isCreating}
                tooltip="New Project"
              >
                {isCreating ? (
                  <Loader2 className="animate-spin shrink-0" />
                ) : (
                  <Plus className="shrink-0" />
                )}
                <span>{isCreating ? "Creating..." : "New Project"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              This will permanently delete the project and all its files. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSessionId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
