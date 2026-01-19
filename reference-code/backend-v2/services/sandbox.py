"""E2B Sandbox Service for hot reload preview.

Manages sandbox lifecycle and provides file operations that trigger
Next.js hot reload automatically.
"""

import os
from typing import Optional
from enum import Enum

from e2b import Sandbox


class SandboxState(Enum):
    """Sandbox lifecycle states."""
    IDLE = "idle"
    CREATING = "creating"
    READY = "ready"
    ERROR = "error"
    CLOSED = "closed"


class SandboxService:
    """Manages E2B sandbox for website generation.

    Key features:
    - Uses pre-built template with Next.js + Tailwind + shadcn
    - Dev server already running (hot reload enabled)
    - Direct file writes trigger instant preview updates
    """

    TEMPLATE = "nextjs16-tailwind4"  # Next.js 16 + Tailwind v4 (same as backend)
    PROJECT_DIR = "/home/user"

    def __init__(self):
        self.sandbox: Optional[Sandbox] = None
        self._state: SandboxState = SandboxState.IDLE

        if not os.getenv("E2B_API_KEY"):
            raise ValueError("E2B_API_KEY environment variable is required")

    @property
    def state(self) -> SandboxState:
        """Current sandbox state."""
        return self._state

    @property
    def sandbox_id(self) -> Optional[str]:
        """Get the sandbox ID if available."""
        if self.sandbox:
            return self.sandbox.sandbox_id
        return None

    def is_ready(self) -> bool:
        """Check if sandbox is ready for file operations."""
        return self.sandbox is not None and self._state == SandboxState.READY

    def create_sandbox(self) -> str:
        """Create a new sandbox using custom template.

        Returns:
            Sandbox ID for reference
        """
        self._state = SandboxState.CREATING
        print(f"Creating sandbox with template: {self.TEMPLATE}")

        try:
            self.sandbox = Sandbox.create(self.TEMPLATE, timeout=600)

            # Clean up default page.tsx to avoid conflicts
            print("Cleaning up default files...")
            self.sandbox.commands.run(f"rm -f {self.PROJECT_DIR}/app/page.tsx")

            # Remove broken shadcn/ui components that cause build errors
            self._cleanup_broken_components()

            self._state = SandboxState.READY
            print(f"Sandbox ready: {self.sandbox.sandbox_id}")
            return self.sandbox.sandbox_id

        except Exception as e:
            self._state = SandboxState.ERROR
            print(f"Failed to create sandbox: {e}")
            raise

    def recreate_sandbox(self) -> str:
        """Recreate sandbox after timeout/crash.

        Used for auto-recovery when sandbox times out during generation.

        Returns:
            New sandbox ID
        """
        print("Recreating sandbox after timeout...")
        self._state = SandboxState.CREATING

        try:
            self.sandbox = Sandbox.create(self.TEMPLATE, timeout=600)

            # Clean up default page.tsx to avoid conflicts
            self.sandbox.commands.run(f"rm -f {self.PROJECT_DIR}/app/page.tsx")

            # Remove broken shadcn/ui components
            self._cleanup_broken_components()

            self._state = SandboxState.READY
            print(f"Sandbox recreated: {self.sandbox.sandbox_id}")
            return self.sandbox.sandbox_id

        except Exception as e:
            self._state = SandboxState.ERROR
            print(f"Failed to recreate sandbox: {e}")
            raise

    def _cleanup_broken_components(self) -> None:
        """Remove shadcn/ui components that have compatibility issues."""
        if not self.sandbox:
            return

        # These components have type errors with current package versions
        broken_components = [
            "resizable.tsx",  # react-resizable-panels incompatibility
        ]

        for component in broken_components:
            path = f"{self.PROJECT_DIR}/components/ui/{component}"
            self.sandbox.commands.run(f"rm -f {path}")

    def connect_sandbox(self, sandbox_id: str) -> None:
        """Connect to an existing sandbox."""
        self.sandbox = Sandbox.connect(sandbox_id)
        self._cleanup_broken_components()
        self._state = SandboxState.READY

    def write_file(self, file_path: str, content: str) -> bool:
        """Write a single file to sandbox (triggers hot reload).

        Args:
            file_path: Relative path from project root (e.g., "app/page.tsx")
            content: File content

        Returns:
            True if write succeeded, False otherwise
        """
        if not self.is_ready():
            print(f"Sandbox not ready, skipping write: {file_path}")
            return False

        try:
            full_path = f"{self.PROJECT_DIR}/{file_path}"

            # Create directory if needed
            dir_path = os.path.dirname(full_path)
            if dir_path:
                self.sandbox.commands.run(f"mkdir -p {dir_path}")

            self.sandbox.files.write(full_path, content)
            print(f"Hot reload: {file_path}")
            return True

        except Exception as e:
            print(f"Write failed for {file_path}: {e}")
            return False

    def read_file(self, file_path: str) -> Optional[str]:
        """Read a file from the sandbox.

        Args:
            file_path: Relative path from project root

        Returns:
            File content or None if not found
        """
        if not self.is_ready():
            return None

        try:
            full_path = f"{self.PROJECT_DIR}/{file_path}"
            content = self.sandbox.files.read(full_path)
            return content
        except Exception:
            return None

    def file_exists(self, file_path: str) -> bool:
        """Check if a file exists in the sandbox."""
        if not self.is_ready():
            return False

        try:
            full_path = f"{self.PROJECT_DIR}/{file_path}"
            result = self.sandbox.commands.run(f"test -f {full_path}")
            return result.exit_code == 0
        except Exception:
            return False

    def get_preview_url(self) -> str:
        """Get the dev server URL for hot reload preview.

        The Next.js dev server is already running via the E2B template's
        set_start_cmd. This returns the URL for immediate preview.
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized.")

        return f"https://{self.sandbox.get_host(3000)}"

    def run_command(self, command: str) -> tuple[int, str, str]:
        """Run a command in the sandbox.

        Returns:
            (exit_code, stdout, stderr)
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized.")

        result = self.sandbox.commands.run(command)
        return result.exit_code, result.stdout or "", result.stderr or ""

    def close(self) -> None:
        """Terminate the sandbox."""
        if self.sandbox:
            print(f"Closing sandbox: {self.sandbox.sandbox_id}")
            self.sandbox.kill()
            self.sandbox = None
            self._state = SandboxState.CLOSED
