"""LangChain tools for file operations and command execution.

Supports dual-write mode when SandboxContext is set:
- Writes to E2B sandbox first (triggers hot reload)
- Then writes to local backup (for persistence)
"""

import re
from pathlib import Path
import subprocess
from typing import Optional, TYPE_CHECKING
from langchain.tools import tool


# Whitelist of allowed packages (matches PACKAGE REFERENCE in architecture prompt)
ALLOWED_PACKAGES = {
    # Games
    "phaser", "pixi.js",
    # Charts
    "recharts", "@tremor/react", "d3",
    # Animation
    "framer-motion", "gsap", "@react-spring/web",
    # Forms
    "react-hook-form", "zod", "@hookform/resolvers",
    # Rich Content
    "@tiptap/react", "@tiptap/starter-kit", "react-markdown",
    # State
    "zustand", "@tanstack/react-query",
    # Interaction
    "@hello-pangea/dnd", "react-window",
    # Date
    "date-fns", "react-day-picker",
    # 3D
    "three", "@react-three/fiber", "@react-three/drei",
    # Maps
    "react-leaflet", "leaflet",
    # Types (auto-added when needed)
    "@types/three", "@types/leaflet",
}


def validate_package_name(name: str) -> bool:
    """Validate package name format and whitelist."""
    # Check format (npm package name pattern)
    if not re.match(r'^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$', name):
        return False
    # Check whitelist
    return name in ALLOWED_PACKAGES

if TYPE_CHECKING:
    from services.sandbox_context import SandboxContext

# Global context - set by agent.py before running
_sandbox_context: Optional["SandboxContext"] = None


def set_sandbox_context(context: "SandboxContext") -> None:
    """Set the sandbox context for file operations."""
    global _sandbox_context
    _sandbox_context = context


def get_sandbox_context() -> Optional["SandboxContext"]:
    """Get the current sandbox context."""
    return _sandbox_context


def clear_sandbox_context() -> None:
    """Clear the sandbox context."""
    global _sandbox_context
    _sandbox_context = None


@tool
def write_file(file_path: str, content: str) -> str:
    """
    Write content to a file.
    Writes to E2B sandbox first (hot reload), then local backup.
    """
    global _sandbox_context

    # Dual-write if sandbox context available
    if _sandbox_context:
        success = _sandbox_context.write_file(file_path, content)
        if success:
            hot_reload = "Hot reload" if _sandbox_context.is_sandbox_ready() else "Local"
            return f"{hot_reload}: {file_path}"
        return f"Failed to write: {file_path}"

    # Fallback: local-only write
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"Created: {file_path}")
    return f"File written successfully at {path.resolve()}"


@tool
def read_file(file_path: str) -> str:
    """
    Read and return content of a file.
    Reads from E2B sandbox first, then local fallback.
    """
    global _sandbox_context

    # Read from context if available
    if _sandbox_context:
        content = _sandbox_context.read_file(file_path)
        if content is not None:
            return content
        return f"File not found: {file_path}"

    # Fallback: local read
    path = Path(file_path)

    if "node_modules" in str(path):
        return "Error: Cannot read from node_modules."

    if not path.exists():
        return f"File not found at {path.resolve()}"

    if path.is_dir():
        return f"Error: '{path}' is a directory."

    if path.stat().st_size > 50000:
        return f"Error: File too large ({path.stat().st_size} bytes). Max 50KB."

    return path.read_text(encoding="utf-8")


@tool
def update_file(file_path: str, content: str) -> str:
    """
    Update (overwrite) content of an existing file.
    Uses E2B sandbox if available.
    """
    global _sandbox_context

    if _sandbox_context:
        if not _sandbox_context.file_exists(file_path):
            return f"File does not exist: {file_path}"
        success = _sandbox_context.write_file(file_path, content)
        if success:
            return f"Updated: {file_path}"
        return f"Failed to update: {file_path}"

    # Fallback
    path = Path(file_path)
    if not path.exists():
        return f"File does not exist at {path.resolve()}"

    path.write_text(content, encoding="utf-8")
    print(f"Updated: {file_path}")
    return f"File updated successfully at {path.resolve()}"


@tool
def run_command(command: str, working_dir: str = None) -> str:
    """
    Execute a shell command and return its output.
    Runs in E2B sandbox if available, otherwise locally.
    """
    global _sandbox_context

    # Run in sandbox if available
    if _sandbox_context and _sandbox_context.is_sandbox_ready():
        exit_code, stdout, stderr = _sandbox_context.sandbox.run_command(command)
        output = stdout.strip()
        if stderr:
            output += f"\nStderr: {stderr.strip()}"
        if exit_code != 0:
            return f"Error (exit code {exit_code}):\n{stderr.strip()}"
        return output if output else "Command completed successfully"

    # Fallback: local execution
    print(f"Running: {command}")
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=True,
            text=True,
            cwd=working_dir,
            timeout=300
        )
        output = result.stdout.strip()
        if result.stderr:
            output += f"\nStderr: {result.stderr.strip()}"
        return output if output else "Command completed successfully"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 5 minutes"
    except subprocess.CalledProcessError as e:
        return f"Error (exit code {e.returncode}):\n{e.stderr.strip()}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def install_packages(packages: str) -> str:
    """
    Install npm packages in the sandbox.

    Args:
        packages: Space-separated package names (e.g., "phaser" or "recharts zustand")

    Only packages from PACKAGES section in architecture.md should be installed.
    """
    global _sandbox_context

    if not _sandbox_context or not _sandbox_context.is_sandbox_ready():
        return "Error: Sandbox not ready for package installation"

    # Parse and validate packages
    package_list = packages.strip().split()
    invalid = [p for p in package_list if not validate_package_name(p)]

    if invalid:
        return f"Error: Package(s) not in allowed list: {', '.join(invalid)}"

    if not package_list:
        return "Error: No packages specified"

    # Install all packages in one command (faster)
    packages_str = ' '.join(package_list)
    command = f"cd /home/user && npm install {packages_str}"
    exit_code, stdout, stderr = _sandbox_context.sandbox.run_command(command)

    # If peer dependency conflict, retry with --legacy-peer-deps
    if exit_code != 0 and "ERESOLVE" in stderr:
        print("Peer dependency conflict detected, retrying with --legacy-peer-deps...")
        command = f"cd /home/user && npm install --legacy-peer-deps {packages_str}"
        exit_code, stdout, stderr = _sandbox_context.sandbox.run_command(command)

    if exit_code != 0:
        return f"Failed to install packages: {stderr[:500]}"

    return f"Installed: {', '.join(package_list)}"


@tool
def grep_code(pattern: str, file_glob: str = "**/*.tsx") -> str:
    """
    Search for a pattern in generated code files.
    Returns matching lines with file paths and line numbers.

    Args:
        pattern: Regex pattern to search for (e.g., "className", "useState", "Header")
        file_glob: Glob pattern for files to search (default: **/*.tsx)

    Returns:
        Matching lines with file:line format
    """
    global _sandbox_context

    if not _sandbox_context:
        return "Error: No sandbox context available"

    results = []

    # Search in local file store (backup of generated files)
    if _sandbox_context.file_store:
        import fnmatch

        for file_path, full_path in _sandbox_context.file_store.files.items():
            # Check if file matches glob pattern
            if not fnmatch.fnmatch(file_path, file_glob.replace("**/*", "*")):
                continue

            content = _sandbox_context.file_store.read(file_path)
            if content:
                lines = content.split("\n")
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        results.append(f"{file_path}:{i}: {line.strip()}")

    if not results:
        return f"No matches found for pattern '{pattern}' in {file_glob}"

    # Limit results to avoid token overflow
    if len(results) > 20:
        return "\n".join(results[:20]) + f"\n... and {len(results) - 20} more matches"

    return "\n".join(results)


@tool
def list_project_files() -> str:
    """
    List all files in the generated project.
    Helps understand the project structure before making changes.

    Returns:
        List of file paths in the project
    """
    global _sandbox_context

    if not _sandbox_context:
        return "Error: No sandbox context available"

    files = []

    # List from local file store
    if _sandbox_context.file_store:
        files = list(_sandbox_context.file_store.files.keys())

    if not files:
        return "No files generated yet"

    # Group by directory for better readability
    files.sort()
    return "Project files:\n" + "\n".join(f"  - {f}" for f in files)
