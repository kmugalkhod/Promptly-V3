"""SandboxContext for dual-write operations.

Provides unified interface for file operations:
1. Write to E2B sandbox FIRST (triggers hot reload)
2. Write to local storage (backup for persistence)
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .sandbox import SandboxService


@dataclass
class LocalFileStore:
    """Local file storage for backup."""

    base_path: Path
    files: dict[str, str] = field(default_factory=dict)

    def __post_init__(self):
        self.base_path = Path(self.base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def write(self, path: str, content: str) -> None:
        """Write file to local storage."""
        full_path = self.base_path / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        self.files[path] = str(full_path)
        print(f"Local backup: {path}")

    def read(self, path: str) -> Optional[str]:
        """Read file from local storage."""
        full_path = self.base_path / path
        if full_path.exists() and full_path.is_file():
            return full_path.read_text(encoding="utf-8")
        return None

    def exists(self, path: str) -> bool:
        """Check if file exists in local storage."""
        full_path = self.base_path / path
        return full_path.exists() and full_path.is_file()

    def get_project_path(self) -> str:
        """Get the full path to the local project directory."""
        return str(self.base_path.resolve())


@dataclass
class SandboxContext:
    """Dual-write context for sandbox + local operations.

    Lovable-style architecture:
    - Sandbox is source of truth during generation
    - Local store is backup for persistence/GitHub migration
    """

    sandbox: SandboxService
    file_store: LocalFileStore
    session_id: str

    def write_file(self, path: str, content: str) -> bool:
        """Write to sandbox first (hot reload), then local backup.

        Includes auto-recovery: if sandbox times out, recreates it
        and restores all files from local backup.

        Returns:
            True if at least one write succeeded
        """
        sandbox_success = False
        local_success = False

        # 1. Sandbox FIRST (triggers hot reload)
        if self.sandbox and self.sandbox.is_ready():
            try:
                sandbox_success = self.sandbox.write_file(path, content)
            except Exception as e:
                error_msg = str(e).lower()
                if "sandbox was not found" in error_msg or "timeout" in error_msg:
                    print(f"Sandbox timeout detected, recovering...")
                    self.recover_sandbox()
                    # Retry write after recovery
                    sandbox_success = self.sandbox.write_file(path, content)
                else:
                    print(f"Sandbox write failed for {path}: {e}")

        # 2. Local backup (always write, used for recovery)
        if self.file_store:
            try:
                self.file_store.write(path, content)
                local_success = True
            except Exception as e:
                print(f"Local write failed for {path}: {e}")

        return sandbox_success or local_success

    def recover_sandbox(self) -> str:
        """Recover from sandbox timeout by creating new sandbox and restoring files.

        Returns:
            New preview URL
        """
        print("Recovering sandbox - creating new sandbox and restoring files...")

        # Create new sandbox
        self.sandbox.recreate_sandbox()

        # Restore all files from local backup
        # file_store.files dict tracks {relative_path: full_path}
        for relative_path in self.file_store.files.keys():
            content = self.file_store.read(relative_path)
            if content:
                self.sandbox.write_file(relative_path, content)
                print(f"Restored: {relative_path}")

        new_url = self.sandbox.get_preview_url()
        print(f"Sandbox recovered! New preview: {new_url}")
        return new_url

    def read_file(self, path: str) -> Optional[str]:
        """Read from sandbox first, then local fallback."""
        # Sandbox first (source of truth)
        if self.sandbox and self.sandbox.is_ready():
            content = self.sandbox.read_file(path)
            if content is not None:
                return content

        # Local fallback
        if self.file_store and self.file_store.exists(path):
            return self.file_store.read(path)

        return None

    def file_exists(self, path: str) -> bool:
        """Check if file exists in sandbox or local."""
        if self.sandbox and self.sandbox.is_ready():
            if self.sandbox.file_exists(path):
                return True

        if self.file_store:
            return self.file_store.exists(path)

        return False

    def get_preview_url(self) -> Optional[str]:
        """Get hot reload preview URL."""
        if self.sandbox and self.sandbox.is_ready():
            return self.sandbox.get_preview_url()
        return None

    def is_sandbox_ready(self) -> bool:
        """Check if sandbox is ready for operations."""
        return self.sandbox is not None and self.sandbox.is_ready()

    def get_local_path(self) -> str:
        """Get the local backup path."""
        return self.file_store.get_project_path()
