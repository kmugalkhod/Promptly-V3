"""
Chat-Based Website Builder

Interactive CLI for building and modifying websites through conversation.
Supports:
- Creating new projects (triggers Architecture -> Coder workflow)
- Modifying existing projects (direct changes via Chat Agent)
- Searching codebase (grep_code, list_project_files)

Usage:
    python chat_agent.py
"""

import uuid
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from tools import set_sandbox_context, clear_sandbox_context
from utils import extract_app_name_from_architecture
from services.sandbox import SandboxService
from services.sandbox_context import SandboxContext, LocalFileStore
from services.session_manager import SessionManager, ChatSession
from agents import create_architecture_agent, create_coder_agent, create_chat_agent

# Configuration
OUTPUT_DIR = Path("./generated_apps")


def print_header():
    """Print welcome header."""
    print("\n" + "=" * 60)
    print("    Website Builder Chat")
    print("    Build Next.js websites through conversation")
    print("=" * 60)
    print("\nCommands:")
    print("  /new      - Start a new project")
    print("  /files    - List project files")
    print("  /preview  - Show preview URL")
    print("  /status   - Show session status")
    print("  /quit     - Exit")
    print("\nJust type what you want to build or change!")
    print("-" * 60)


def is_new_project_request(message: str) -> bool:
    """Check if the user is requesting a new project."""
    new_project_keywords = [
        "create", "build", "make", "generate", "start",
        "new project", "new app", "new website", "new application",
        "i want", "i need", "can you build", "can you create"
    ]
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in new_project_keywords)


def is_big_change_request(message: str) -> bool:
    """Check if the request requires architectural changes."""
    big_change_keywords = [
        "authentication", "auth", "login", "signup", "register",
        "payment", "stripe", "checkout",
        "new page", "add page", "create page", "new route",
        "database", "backend", "api endpoint",
        "restructure", "rebuild", "redesign completely"
    ]
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in big_change_keywords)


def setup_sandbox(session: ChatSession, app_name: str) -> str:
    """Setup E2B sandbox for the session.

    Returns:
        Preview URL for the sandbox
    """
    session_id = str(uuid.uuid4())[:8]

    # Setup local backup directory
    local_path = OUTPUT_DIR / app_name
    local_path.mkdir(parents=True, exist_ok=True)
    file_store = LocalFileStore(base_path=local_path)

    # Create E2B sandbox
    print("  Starting E2B sandbox...")
    sandbox_service = SandboxService()
    sandbox_service.create_sandbox()

    # Create context for dual-write
    context = SandboxContext(
        sandbox=sandbox_service,
        file_store=file_store,
        session_id=session_id
    )

    # Set global context for tools
    set_sandbox_context(context)

    # Update session
    session.sandbox_context = context
    session.app_name = app_name
    session.preview_url = sandbox_service.get_preview_url()

    print(f"  Sandbox ready!")
    print(f"  Preview: {session.preview_url}")

    return session.preview_url


def ensure_sandbox(session: ChatSession) -> bool:
    """Ensure sandbox is available, recover if needed.

    Returns:
        True if sandbox is ready, False otherwise
    """
    if session.sandbox_context and session.sandbox_context.is_sandbox_ready():
        return True

    if not session.app_name:
        print("\nNo project loaded. Create a new project first.")
        return False

    # Try to recover sandbox
    print("\nRecovering sandbox...")
    try:
        if session.sandbox_context:
            session.sandbox_context.recover_sandbox()
            set_sandbox_context(session.sandbox_context)
            session.preview_url = session.sandbox_context.sandbox.get_preview_url()
            print(f"Sandbox recovered! Preview: {session.preview_url}")
            return True
    except Exception as e:
        print(f"Failed to recover sandbox: {e}")
        return False

    return False


def extract_response(result) -> str:
    """Extract text response from agent result."""
    if isinstance(result, str):
        return result

    if isinstance(result, dict):
        # Handle LangGraph response format
        if "messages" in result:
            messages = result["messages"]
            if messages:
                last_msg = messages[-1]
                if hasattr(last_msg, "content"):
                    content = last_msg.content
                    # Handle list content (tool calls + text)
                    if isinstance(content, list):
                        text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and "text" in p]
                        return " ".join(text_parts) if text_parts else "Done!"
                    return content
                elif isinstance(last_msg, dict):
                    return last_msg.get("content", "Done!")

        # Direct content
        if "content" in result:
            return result["content"]

    return "Done!"


def sync_files_from_sandbox(session: ChatSession):
    """Sync files from sandbox/file_store to session."""
    if not session.sandbox_context:
        return

    file_store = session.sandbox_context.file_store
    if file_store and hasattr(file_store, 'files'):
        for path, content in file_store.files.items():
            if content:
                session.add_file(path, content)


def run_new_project(session: ChatSession, user_message: str) -> str:
    """Run the full Architecture -> Coder workflow for a new project."""
    print("\n" + "=" * 60)
    print("  Creating New Project")
    print("=" * 60)

    # Step 1: Generate a temporary app name for sandbox setup
    temp_app_name = f"app-{str(uuid.uuid4())[:8]}"

    # Step 2: Setup sandbox FIRST (so architecture agent writes to it)
    print("\n[1/3] Setting up sandbox...")
    preview_url = setup_sandbox(session, temp_app_name)

    # Step 3: Run Architecture Agent
    print("\n[2/3] Designing architecture...")
    print("  Analyzing requirements and planning structure...")

    arch_agent = create_architecture_agent()
    arch_result = arch_agent.invoke({
        "messages": [{
            "role": "user",
            "content": f"Design the architecture for: {user_message}"
        }]
    })

    # Read architecture from file store
    arch_content = None
    if session.sandbox_context and session.sandbox_context.file_store:
        arch_content = session.sandbox_context.file_store.read("architecture.md")

    if not arch_content:
        # Try local file as fallback
        try:
            arch_content = Path("architecture.md").read_text(encoding="utf-8")
        except FileNotFoundError:
            return "Error: Failed to create architecture. Please try again."

    session.architecture = arch_content

    # Extract actual app name from architecture
    actual_app_name = extract_app_name_from_architecture(arch_content)
    if actual_app_name != temp_app_name:
        session.app_name = actual_app_name
        # Rename local directory if needed
        old_path = OUTPUT_DIR / temp_app_name
        new_path = OUTPUT_DIR / actual_app_name
        if old_path.exists() and not new_path.exists():
            old_path.rename(new_path)
            session.sandbox_context.file_store.base_path = new_path

    print(f"  Architecture ready: {session.app_name}")

    # Step 4: Run Coder Agent
    print("\n[3/3] Implementing code...")
    print("  Building components and pages...")

    coder_agent = create_coder_agent()
    coder_result = coder_agent.invoke({
        "messages": [{
            "role": "user",
            "content": f"""Implement the Next.js application based on this architecture:

{arch_content}

The sandbox is ready with Next.js 16, Tailwind CSS v4, and shadcn/ui.
Preview URL: {preview_url}

Create all the files needed for a working application.
"""
        }]
    })

    # Sync files to session
    sync_files_from_sandbox(session)

    file_count = len(session.generated_files)

    print("\n" + "=" * 60)
    print(f"  Project Created: {session.app_name}")
    print(f"  Files: {file_count}")
    print(f"  Preview: {session.preview_url}")
    print("=" * 60)

    return f"""Project "{session.app_name}" created successfully!

Preview: {session.preview_url}
Files created: {file_count}

You can now ask me to make changes like:
- "Make the header background blue"
- "Add a contact form to the homepage"
- "Change the title to Welcome"
"""


def run_modification(session: ChatSession, user_message: str) -> str:
    """Run the Chat Agent for modifications."""
    # Ensure sandbox is available
    if not ensure_sandbox(session):
        return "Cannot make changes without a sandbox. Please create a new project first with /new"

    print("\nProcessing your request...")

    # Use smart context with relevance scoring
    smart_context = session.get_smart_context(user_message)
    chat_agent = create_chat_agent(smart_context, use_smart_context=True)

    result = chat_agent.invoke({
        "messages": [{
            "role": "user",
            "content": user_message
        }]
    })

    # Sync updated files
    sync_files_from_sandbox(session)

    # Extract and return response
    response = extract_response(result)

    if session.preview_url:
        response += f"\n\nPreview: {session.preview_url}"

    return response


def handle_message(session: ChatSession, user_message: str) -> str:
    """Handle a user message and return the response."""
    session.add_message("user", user_message)

    try:
        # Determine action based on session state and message content
        if session.is_new_session():
            # No project yet - treat as new project request
            response = run_new_project(session, user_message)
        elif is_new_project_request(user_message) and not session.generated_files:
            # Explicit new project request with no files
            response = run_new_project(session, user_message)
        elif is_big_change_request(user_message):
            # Big change - warn user
            response = (
                "This looks like a significant change. I'll try to make it directly.\n"
                "For major structural changes, consider starting a new project with /new\n\n"
            )
            response += run_modification(session, user_message)
        else:
            # Regular modification
            response = run_modification(session, user_message)

    except Exception as e:
        response = f"Error: {str(e)}\n\nPlease try again or type /new to start fresh."

    session.add_message("assistant", response)
    return response


def show_status(session: ChatSession):
    """Show current session status."""
    print("\n" + "-" * 40)
    print("Session Status")
    print("-" * 40)
    print(f"  App Name: {session.app_name or '(none)'}")
    print(f"  Files: {len(session.generated_files)}")
    print(f"  Messages: {len(session.conversation_history)}")

    if session.sandbox_context:
        sandbox_ok = session.sandbox_context.is_sandbox_ready()
        print(f"  Sandbox: {'Ready' if sandbox_ok else 'Not ready'}")
    else:
        print("  Sandbox: Not initialized")

    if session.preview_url:
        print(f"  Preview: {session.preview_url}")
    print("-" * 40)


def main():
    """Main chat loop."""
    print_header()

    # Create session manager and session
    manager = SessionManager()
    session = manager.create_session()

    print("\nWhat would you like to build today?")

    try:
        while True:
            try:
                # Get user input
                user_input = input("\nYou: ").strip()

                if not user_input:
                    continue

                # Handle commands
                cmd = user_input.lower()

                if cmd == "/quit" or cmd == "/exit":
                    print("\nGoodbye! Your project is saved locally.")
                    break

                if cmd == "/new":
                    # Close existing sandbox
                    if session.sandbox_context and session.sandbox_context.sandbox:
                        try:
                            session.sandbox_context.sandbox.close()
                        except:
                            pass
                    clear_sandbox_context()

                    # Create new session
                    session = manager.create_session()
                    print("\nNew session started. What would you like to build?")
                    continue

                if cmd == "/files":
                    files = session.list_files()
                    if files:
                        print("\nProject files:")
                        for f in sorted(files):
                            print(f"  {f}")
                    else:
                        print("\nNo files generated yet. Start by describing what you want to build.")
                    continue

                if cmd == "/preview":
                    if session.preview_url:
                        print(f"\nPreview URL: {session.preview_url}")
                    else:
                        print("\nNo preview available. Create a project first.")
                    continue

                if cmd == "/status":
                    show_status(session)
                    continue

                if cmd.startswith("/"):
                    print(f"\nUnknown command: {cmd}")
                    print("Available: /new, /files, /preview, /status, /quit")
                    continue

                # Handle regular message
                response = handle_message(session, user_input)
                print(f"\nAssistant: {response}")

            except KeyboardInterrupt:
                print("\n\n(Interrupted - type /quit to exit)")
                continue
            except Exception as e:
                print(f"\nError: {e}")
                print("Type /quit to exit or try again.")
                continue

    finally:
        # Cleanup
        print("\nCleaning up...")
        if session.sandbox_context and session.sandbox_context.sandbox:
            try:
                session.sandbox_context.sandbox.close()
            except:
                pass
        clear_sandbox_context()

        if session.app_name:
            print(f"Project saved to: {OUTPUT_DIR / session.app_name}")
        print("Session ended.")


if __name__ == "__main__":
    main()
