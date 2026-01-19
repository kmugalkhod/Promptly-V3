"""Chat Session Manager for interactive website building.

Maintains conversation history, tracks generated files, and stores
sandbox context between chat messages.
"""

import uuid
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

from .sandbox_context import SandboxContext
from .context_builder import (
    RelevanceScorer, ContextBuilder, SmartContext,
    FileContent, FileSummary
)


@dataclass
class ChatMessage:
    """A single message in the conversation."""
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ChatSession:
    """Manages state for a chat-based website building session.

    Tracks:
    - Conversation history
    - Generated files
    - Architecture document
    - Sandbox context
    """

    session_id: str
    sandbox_context: Optional[SandboxContext] = None
    conversation_history: list[ChatMessage] = field(default_factory=list)
    generated_files: dict[str, str] = field(default_factory=dict)  # {path: content}
    architecture: str = ""  # architecture.md content
    app_name: str = ""
    preview_url: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str) -> None:
        """Add a message to conversation history."""
        self.conversation_history.append(ChatMessage(role=role, content=content))

    def add_file(self, path: str, content: str) -> None:
        """Track a generated file."""
        self.generated_files[path] = content

    def get_file(self, path: str) -> Optional[str]:
        """Get content of a tracked file."""
        return self.generated_files.get(path)

    def list_files(self) -> list[str]:
        """List all tracked file paths."""
        return list(self.generated_files.keys())

    def get_recent_messages(self, n: int = 10) -> list[ChatMessage]:
        """Get the N most recent messages."""
        return self.conversation_history[-n:]

    def get_context_summary(self) -> str:
        """Build a context summary for the chat agent."""
        files_list = "\n".join(f"  - {f}" for f in self.generated_files.keys())

        recent_msgs = self.get_recent_messages(5)
        msgs_text = "\n".join(
            f"  {m.role}: {m.content[:100]}..." if len(m.content) > 100 else f"  {m.role}: {m.content}"
            for m in recent_msgs
        )

        return f"""## Current Project Context

App Name: {self.app_name}
Preview URL: {self.preview_url}

### Generated Files:
{files_list if files_list else "  (none yet)"}

### Recent Conversation:
{msgs_text if msgs_text else "  (new session)"}

### Architecture:
{self.architecture[:500] if self.architecture else "(not yet created)"}
"""

    def is_new_session(self) -> bool:
        """Check if this is a fresh session with no project."""
        return len(self.generated_files) == 0 and not self.architecture

    def get_smart_context(self, query: str) -> str:
        """Build smart context for the chat agent using relevance scoring.

        Args:
            query: User's query string for relevance scoring

        Returns:
            Formatted context string with pre-loaded files and summaries
        """
        if not self.generated_files:
            return self.get_context_summary()

        # Build smart context
        scorer = RelevanceScorer()
        builder = ContextBuilder(scorer=scorer)
        smart_context = builder.build_context(self.generated_files, query)

        return format_smart_context(smart_context, self)


def format_smart_context(smart_context: SmartContext, session: 'ChatSession') -> str:
    """Format SmartContext into a prompt string.

    Args:
        smart_context: The SmartContext object with files and summaries
        session: The ChatSession for metadata

    Returns:
        Formatted context string
    """
    # Build full files section
    full_files_lines = []
    for file_content in smart_context.full_files:
        # Determine language for code block
        ext = file_content.path.split('.')[-1] if '.' in file_content.path else ''
        lang = ext if ext in ('tsx', 'ts', 'css', 'scss', 'json', 'md') else ''
        full_files_lines.append(f"### {file_content.path}")
        full_files_lines.append(f"```{lang}")
        full_files_lines.append(file_content.content)
        full_files_lines.append("```")
        full_files_lines.append("")

    full_files_section = "\n".join(full_files_lines) if full_files_lines else "(none)"

    # Build summaries section
    summaries_lines = []
    for summary in smart_context.summaries:
        summaries_lines.append(f"- {summary.path} ({summary.line_count} lines) - {summary.purpose}")

    summaries_section = "\n".join(summaries_lines) if summaries_lines else "(none)"

    # Build recent messages section
    recent_msgs = session.get_recent_messages(5)
    msgs_text = "\n".join(
        f"  {m.role}: {m.content[:100]}..." if len(m.content) > 100 else f"  {m.role}: {m.content}"
        for m in recent_msgs
    )

    return f"""## Current Project Context

App Name: {session.app_name}
Preview URL: {session.preview_url}

## Relevant Files (Pre-loaded)

The following files are most relevant to your request. Use them directly without calling read_file:

{full_files_section}

## Other Files (Request if needed)

These files exist but weren't pre-loaded. Use read_file if you need them:

{summaries_section}

## Recent Conversation

{msgs_text if msgs_text else "(new session)"}

## Architecture Summary

{session.architecture[:500] if session.architecture else "(not yet created)"}
"""


class SessionManager:
    """Manages multiple chat sessions."""

    def __init__(self):
        self.sessions: dict[str, ChatSession] = {}
        self.current_session_id: Optional[str] = None

    def create_session(self) -> ChatSession:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())[:8]
        session = ChatSession(session_id=session_id)
        self.sessions[session_id] = session
        self.current_session_id = session_id
        return session

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get a session by ID."""
        return self.sessions.get(session_id)

    def get_current_session(self) -> Optional[ChatSession]:
        """Get the current active session."""
        if self.current_session_id:
            return self.sessions.get(self.current_session_id)
        return None

    def set_current_session(self, session_id: str) -> bool:
        """Set the current active session."""
        if session_id in self.sessions:
            self.current_session_id = session_id
            return True
        return False

    def list_sessions(self) -> list[ChatSession]:
        """List all sessions."""
        return list(self.sessions.values())

    def close_session(self, session_id: str) -> None:
        """Close and cleanup a session."""
        session = self.sessions.get(session_id)
        if session:
            # Close sandbox if exists
            if session.sandbox_context and session.sandbox_context.sandbox:
                session.sandbox_context.sandbox.close()
            del self.sessions[session_id]

            if self.current_session_id == session_id:
                self.current_session_id = None
