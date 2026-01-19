"""
Next.js Website Generator with Multi-Agent Architecture

This module implements a two-agent sequential workflow:
1. Architecture Agent - Designs the application structure
2. Coder Agent - Implements the design in Next.js

Now with E2B sandbox integration for hot reload preview.

Usage:
    python agent.py
"""

import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from tools import set_sandbox_context, clear_sandbox_context
from utils import extract_app_name_from_architecture
from services.sandbox import SandboxService
from services.sandbox_context import SandboxContext, LocalFileStore
from agents import create_architecture_agent, create_coder_agent

# Configuration
OUTPUT_DIR = Path("./generated_apps")


def setup_sandbox_environment(app_name: str) -> tuple[SandboxContext, str]:
    """Setup E2B sandbox with local backup.

    The E2B template already has:
    - Next.js 16 with App Router
    - Tailwind CSS v4
    - All shadcn/ui components installed
    - Dev server running with hot reload

    Args:
        app_name: Name of the app (used for local backup directory)

    Returns:
        (SandboxContext, preview_url)
    """
    # Create unique session ID
    session_id = str(uuid.uuid4())[:8]

    # Setup local backup directory
    local_path = OUTPUT_DIR / app_name
    file_store = LocalFileStore(base_path=local_path)

    # Create E2B sandbox (template already has Next.js + Tailwind + shadcn)
    sandbox_service = SandboxService()
    sandbox_service.create_sandbox()

    # Create context for dual-write operations
    context = SandboxContext(
        sandbox=sandbox_service,
        file_store=file_store,
        session_id=session_id
    )

    # Set context for tools
    set_sandbox_context(context)

    preview_url = sandbox_service.get_preview_url()

    return context, preview_url


def run_workflow(user_requirements: str):
    """
    Execute the two-agent sequential workflow with E2B integration.

    Steps:
    1. Architecture Agent designs the app and writes architecture.md
    2. Extract app name from architecture document
    3. Setup E2B sandbox (NO scaffolding needed - template ready)
    4. Coder Agent implements the design with hot reload

    Args:
        user_requirements: The user's project description/requirements

    Returns:
        A dictionary containing:
        - preview_url: Hot reload preview URL
        - local_path: Path to local backup
        - architecture_doc: Path to the architecture document
        - arch_result: Result from Architecture Agent
        - coder_result: Result from Coder Agent
        - sandbox_context: Reference to sandbox context for cleanup
    """
    context = None

    try:
        # === PHASE 1: Architecture Design ===
        print("\n" + "=" * 60)
        print("PHASE 1: Architecture Design")
        print("=" * 60 + "\n")

        arch_agent = create_architecture_agent()
        arch_result = arch_agent.invoke({
            "messages": [{
                "role": "user",
                "content": f"Design the architecture for the following project:\n\n{user_requirements}"
            }]
        })

        print("Architecture Agent completed.")

        # Read the generated architecture document
        arch_doc_path = "architecture.md"
        try:
            arch_content = Path(arch_doc_path).read_text(encoding="utf-8")
            print(f"Architecture document created: {arch_doc_path}")
        except FileNotFoundError:
            print("Error: Architecture document was not created")
            raise RuntimeError("Architecture Agent failed to create architecture.md")

        # === PHASE 2: Setup E2B Sandbox ===
        print("\n" + "=" * 60)
        print("PHASE 2: Setting up E2B Sandbox")
        print("=" * 60 + "\n")

        app_name = extract_app_name_from_architecture(arch_content)
        print(f"Extracted app name: {app_name}")

        # Setup sandbox - template already has Next.js ready!
        context, preview_url = setup_sandbox_environment(app_name)

        print(f"E2B Sandbox ready!")
        print(f"Preview URL: {preview_url}")
        print(f"Local backup: {context.get_local_path()}")

        # === PHASE 3: Code Implementation (with Hot Reload) ===
        print("\n" + "=" * 60)
        print("PHASE 3: Code Implementation (Hot Reload Enabled)")
        print("=" * 60 + "\n")

        coder_agent = create_coder_agent()
        coder_result = coder_agent.invoke({
            "messages": [{
                "role": "user",
                "content": f"""Implement the Next.js application based on this architecture document:

{arch_content}

The Next.js app is ALREADY SETUP in E2B sandbox with:
- Next.js 16 with App Router
- Tailwind CSS v4
- shadcn/ui components (all installed)

**IMPORTANT: Check if architecture.md has a PACKAGES section.**
If packages are listed, install them FIRST using install_packages tool before writing any code.
Example: install_packages("phaser zustand")

FILE PATHS (use these exact paths):
- app/layout.tsx (MUST CREATE FIRST - required for styles!)
- app/page.tsx (home page)
- app/[route]/page.tsx (other pages)
- components/Name.tsx (components)
- lib/utils.ts (DO NOT OVERWRITE - already has cn function)
- types/index.ts (types)

IMPORTANT:
- Files are written directly to E2B sandbox with hot reload
- Preview is live at: {preview_url}
- Do NOT run npm run dev - already running!
- Use shadcn/ui components: import from "@/components/ui/..."
"""
            }]
        })

        print("Coder Agent completed.")

        # === COMPLETION ===
        print("\n" + "=" * 60)
        print("WORKFLOW COMPLETE")
        print("=" * 60)
        print(f"\nPreview URL (hot reload): {preview_url}")
        print(f"Local backup: {context.get_local_path()}")
        print("\nThe app is already running with hot reload enabled!")

        return {
            "preview_url": preview_url,
            "local_path": context.get_local_path(),
            "architecture_doc": arch_doc_path,
            "arch_result": arch_result,
            "coder_result": coder_result,
            "sandbox_context": context,
        }

    except Exception as e:
        print(f"\nError during workflow: {e}")
        # Cleanup on error
        if context and context.sandbox:
            context.sandbox.close()
        clear_sandbox_context()
        raise


# Main execution
if __name__ == "__main__":
    # Example project requirements
    user_requirements = """
    simple todo application 
    """

    result = run_workflow(user_requirements)

    print("\n" + "=" * 60)
    print("To keep the preview running, the sandbox is still active.")
    print("Press Ctrl+C to close the sandbox and exit.")
    print("=" * 60)

    try:
        # Keep running until interrupted
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        if result.get("sandbox_context"):
            result["sandbox_context"].sandbox.close()
        clear_sandbox_context()
        print("Sandbox closed. Goodbye!")
