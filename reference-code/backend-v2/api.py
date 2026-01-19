"""FastAPI REST API for Chat-Based Website Builder.

Provides HTTP endpoints for:
- Session management (create, list, get, delete)
- Chat messaging (send messages, get history)
- File operations (list files, read content)
- Preview URL access

Usage:
    uvicorn api:app --reload --port 8000
"""

import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from schemas import (
    CreateSessionResponse, SessionInfo, SessionListResponse, SessionDetailResponse,
    ChatRequest, ChatResponse, MessageItem, MessagesResponse,
    FileInfo, FilesListResponse, FileContentResponse,
    PreviewResponse, ErrorResponse
)
from services.session_manager import SessionManager, ChatSession
from services.sandbox import SandboxService
from services.sandbox_context import SandboxContext, LocalFileStore
from tools import set_sandbox_context, clear_sandbox_context
from utils import extract_app_name_from_architecture
from agents import create_architecture_agent, create_coder_agent, create_chat_agent

# Configuration
OUTPUT_DIR = Path("./generated_apps")

# Global session manager
session_manager = SessionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cleanup sessions on shutdown."""
    yield
    # Cleanup all sessions on shutdown
    for session in session_manager.list_sessions():
        if session.sandbox_context and session.sandbox_context.sandbox:
            try:
                session.sandbox_context.sandbox.close()
            except Exception:
                pass
    clear_sandbox_context()


app = FastAPI(
    title="Website Builder API",
    description="Chat-based website builder with live preview",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Helper Functions
# ============================================================================

def get_session_or_404(session_id: str) -> ChatSession:
    """Get session by ID or raise 404."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return session


def is_new_project_request(message: str) -> bool:
    """Check if the user is requesting a new project."""
    new_project_keywords = [
        "create", "build", "make", "generate", "start",
        "new project", "new app", "new website", "new application"
    ]
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in new_project_keywords)


def is_big_change_request(message: str) -> bool:
    """Check if the request requires architectural changes."""
    big_change_keywords = [
        "authentication", "auth", "login", "signup", "register",
        "payment", "stripe", "checkout",
        "new page", "add page", "create page", "new route",
        "database", "backend", "api",
        "restructure", "rebuild", "redesign completely"
    ]
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in big_change_keywords)


def setup_sandbox(session: ChatSession, app_name: str) -> str:
    """Setup E2B sandbox for the session."""
    session_id = str(uuid.uuid4())[:8]

    # Setup local backup
    local_path = OUTPUT_DIR / app_name
    file_store = LocalFileStore(base_path=local_path)

    # Create sandbox
    sandbox_service = SandboxService()
    sandbox_service.create_sandbox()

    # Create context
    context = SandboxContext(
        sandbox=sandbox_service,
        file_store=file_store,
        session_id=session_id
    )

    # Set context for tools
    set_sandbox_context(context)

    # Update session
    session.sandbox_context = context
    session.app_name = app_name
    session.preview_url = sandbox_service.get_preview_url()

    return session.preview_url


def run_new_project(session: ChatSession, user_message: str) -> tuple[str, list[str]]:
    """Run the full Architecture → Coder workflow for a new project."""
    files_changed = []

    # Phase 1: Architecture
    arch_agent = create_architecture_agent()
    arch_agent.invoke({
        "messages": [{
            "role": "user",
            "content": f"Design the architecture for: {user_message}"
        }]
    })

    # Read architecture
    arch_doc_path = "architecture.md"
    try:
        arch_content = Path(arch_doc_path).read_text(encoding="utf-8")
        session.architecture = arch_content
    except FileNotFoundError:
        return "Error: Failed to create architecture document", []

    # Extract app name and setup sandbox
    app_name = extract_app_name_from_architecture(arch_content)
    preview_url = setup_sandbox(session, app_name)

    # Phase 2: Code Implementation
    coder_agent = create_coder_agent()
    coder_agent.invoke({
        "messages": [{
            "role": "user",
            "content": f"""Implement the Next.js application based on this architecture:

{arch_content}

The sandbox is ready with Next.js 16, Tailwind v4, and shadcn/ui.
Preview: {preview_url}
"""
        }]
    })

    # Track generated files
    if session.sandbox_context and session.sandbox_context.file_store:
        for path in session.sandbox_context.file_store.files.keys():
            content = session.sandbox_context.file_store.read(path)
            if content:
                session.add_file(path, content)
                files_changed.append(path)

    return f"Project created! Preview: {preview_url}", files_changed


def run_modification(session: ChatSession, user_message: str) -> tuple[str, list[str]]:
    """Run the Chat Agent for modifications."""
    files_before = set(session.generated_files.keys())

    # Use smart context with relevance scoring
    smart_context = session.get_smart_context(user_message)
    chat_agent = create_chat_agent(smart_context, use_smart_context=True)

    result = chat_agent.invoke({
        "messages": [{
            "role": "user",
            "content": user_message
        }]
    })

    # Update tracked files
    files_changed = []
    if session.sandbox_context and session.sandbox_context.file_store:
        for path in session.sandbox_context.file_store.files.keys():
            content = session.sandbox_context.file_store.read(path)
            if content:
                session.add_file(path, content)
                if path not in files_before:
                    files_changed.append(path)

    # Extract response from agent result
    response = "Changes applied!"
    if isinstance(result, dict) and "messages" in result:
        messages = result["messages"]
        if messages and len(messages) > 0:
            last_msg = messages[-1]
            if hasattr(last_msg, "content"):
                response = last_msg.content
            elif isinstance(last_msg, dict):
                response = last_msg.get("content", "Changes applied!")

    return response, files_changed


# ============================================================================
# Session Endpoints
# ============================================================================

@app.post("/api/sessions", response_model=CreateSessionResponse, tags=["Sessions"])
async def create_session():
    """Create a new chat session."""
    session = session_manager.create_session()
    return CreateSessionResponse(
        session_id=session.session_id,
        created_at=session.created_at
    )


@app.get("/api/sessions", response_model=SessionListResponse, tags=["Sessions"])
async def list_sessions():
    """List all active sessions."""
    sessions = session_manager.list_sessions()
    return SessionListResponse(
        sessions=[
            SessionInfo(
                session_id=s.session_id,
                app_name=s.app_name or "New Session",
                preview_url=s.preview_url,
                created_at=s.created_at,
                file_count=len(s.generated_files)
            )
            for s in sessions
        ]
    )


@app.get("/api/sessions/{session_id}", response_model=SessionDetailResponse, tags=["Sessions"])
async def get_session(session_id: str = PathParam(..., description="Session ID")):
    """Get detailed session information."""
    session = get_session_or_404(session_id)
    return SessionDetailResponse(
        session_id=session.session_id,
        app_name=session.app_name or "New Session",
        preview_url=session.preview_url,
        created_at=session.created_at,
        files=list(session.generated_files.keys()),
        architecture=session.architecture if session.architecture else None,
        message_count=len(session.conversation_history)
    )


@app.delete("/api/sessions/{session_id}", tags=["Sessions"])
async def delete_session(session_id: str = PathParam(..., description="Session ID")):
    """Close and cleanup a session."""
    session = get_session_or_404(session_id)

    # Close sandbox
    if session.sandbox_context and session.sandbox_context.sandbox:
        try:
            session.sandbox_context.sandbox.close()
        except Exception:
            pass

    session_manager.close_session(session_id)
    return {"message": f"Session {session_id} closed"}


# ============================================================================
# Chat Endpoints
# ============================================================================

@app.post("/api/sessions/{session_id}/chat", response_model=ChatResponse, tags=["Chat"])
async def send_message(
    request: ChatRequest,
    session_id: str = PathParam(..., description="Session ID")
):
    """Send a chat message and get response."""
    session = get_session_or_404(session_id)

    user_message = request.message
    session.add_message("user", user_message)

    try:
        # Determine action
        if session.is_new_session() or is_new_project_request(user_message):
            # New project
            response, files_changed = run_new_project(session, user_message)
        elif is_big_change_request(user_message):
            # Big change - inform user
            response = (
                "This looks like a significant change that might benefit from "
                "architectural planning. Would you like me to:\n"
                "1. Try to make the changes directly\n"
                "2. Create a new architecture plan first\n"
                "\nReply with '1' or '2'"
            )
            files_changed = []
        else:
            # Modification
            response, files_changed = run_modification(session, user_message)

        session.add_message("assistant", response)

        return ChatResponse(
            response=response,
            preview_url=session.preview_url,
            files_changed=files_changed
        )

    except Exception as e:
        error_msg = f"Error processing message: {str(e)}"
        session.add_message("assistant", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/api/sessions/{session_id}/messages", response_model=MessagesResponse, tags=["Chat"])
async def get_messages(session_id: str = PathParam(..., description="Session ID")):
    """Get conversation history."""
    session = get_session_or_404(session_id)
    return MessagesResponse(
        messages=[
            MessageItem(
                role=msg.role,
                content=msg.content,
                timestamp=msg.timestamp
            )
            for msg in session.conversation_history
        ]
    )


# ============================================================================
# File Endpoints
# ============================================================================

@app.get("/api/sessions/{session_id}/files", response_model=FilesListResponse, tags=["Files"])
async def list_files(session_id: str = PathParam(..., description="Session ID")):
    """List all generated files in the project."""
    session = get_session_or_404(session_id)
    return FilesListResponse(
        files=[FileInfo(path=path) for path in session.generated_files.keys()]
    )


@app.get("/api/sessions/{session_id}/files/{file_path:path}", response_model=FileContentResponse, tags=["Files"])
async def read_file(
    session_id: str = PathParam(..., description="Session ID"),
    file_path: str = PathParam(..., description="File path")
):
    """Read content of a specific file."""
    session = get_session_or_404(session_id)

    content = session.get_file(file_path)
    if content is None:
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    return FileContentResponse(path=file_path, content=content)


# ============================================================================
# Preview Endpoints
# ============================================================================

@app.get("/api/sessions/{session_id}/preview", response_model=PreviewResponse, tags=["Preview"])
async def get_preview(session_id: str = PathParam(..., description="Session ID")):
    """Get the live preview URL."""
    session = get_session_or_404(session_id)

    if not session.preview_url:
        return PreviewResponse(url=None, status="not_created")

    # Check if sandbox is still ready
    if session.sandbox_context and session.sandbox_context.is_sandbox_ready():
        return PreviewResponse(url=session.preview_url, status="ready")
    else:
        return PreviewResponse(url=session.preview_url, status="error")


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "active_sessions": len(session_manager.sessions)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
