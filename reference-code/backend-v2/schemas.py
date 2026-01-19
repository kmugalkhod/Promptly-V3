"""Pydantic models for the Website Builder REST API."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# Session Models
class CreateSessionResponse(BaseModel):
    """Response when creating a new session."""
    session_id: str
    created_at: datetime


class SessionInfo(BaseModel):
    """Session information."""
    session_id: str
    app_name: str
    preview_url: Optional[str]
    created_at: datetime
    file_count: int


class SessionListResponse(BaseModel):
    """Response for listing all sessions."""
    sessions: list[SessionInfo]


class SessionDetailResponse(BaseModel):
    """Detailed session information."""
    session_id: str
    app_name: str
    preview_url: Optional[str]
    created_at: datetime
    files: list[str]
    architecture: Optional[str]
    message_count: int


# Chat Models
class ChatRequest(BaseModel):
    """Request to send a chat message."""
    message: str


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    response: str
    preview_url: Optional[str]
    files_changed: list[str]


class MessageItem(BaseModel):
    """A single message in conversation history."""
    role: str
    content: str
    timestamp: datetime


class MessagesResponse(BaseModel):
    """Response for getting conversation history."""
    messages: list[MessageItem]


# File Models
class FileInfo(BaseModel):
    """File information."""
    path: str


class FilesListResponse(BaseModel):
    """Response for listing project files."""
    files: list[FileInfo]


class FileContentResponse(BaseModel):
    """Response for reading file content."""
    path: str
    content: str


# Preview Models
class PreviewResponse(BaseModel):
    """Response for getting preview URL."""
    url: Optional[str]
    status: str  # "ready", "not_created", "error"


# Error Models
class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: Optional[str] = None
