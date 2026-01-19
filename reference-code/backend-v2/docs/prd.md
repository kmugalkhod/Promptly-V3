# Smart Context Management for Chat Agent - Brownfield Enhancement PRD

## Introduction

This document captures the requirements for enhancing the Chat Agent's context management system in the Next.js Website Generator project. The enhancement aims to reduce token usage and tool calls by providing intelligently-selected file contents upfront in the agent context.

### Document Scope

Focused on areas relevant to: Chat Agent context building, file relevance scoring, and prompt optimization.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-11 | 1.0 | Initial brownfield PRD | Analyst |

---

## 1. Existing Project Overview

### 1.1 Analysis Source

IDE-based fresh analysis of the backend-v2 codebase.

### 1.2 Current Project State

Next.js Website Generator with multi-agent architecture. Three agents (Architecture, Coder, Chat) generate websites in E2B sandbox with live hot reload. Chat Agent handles post-generation modifications but inefficiently reads all files on every request.

**Current Tech Stack:**
| Category | Technology | Version |
|----------|------------|---------|
| Runtime | Python | 3.12+ |
| Framework | FastAPI | 0.115+ |
| LLM | LangChain + Anthropic | 1.2+ / 1.3+ |
| Model | Claude Haiku | claude-haiku-4-5-20251001 |
| Sandbox | E2B | 1.0+ |

### 1.3 Available Documentation Analysis

| Documentation | Status |
|---------------|--------|
| Tech Stack Documentation | Missing |
| Source Tree/Architecture | Missing |
| Coding Standards | Partial (CLAUDE.md) |
| API Documentation | Missing |
| Technical Debt Documentation | Missing |

### 1.4 Enhancement Scope Definition

**Enhancement Type:** Performance/Scalability Improvements

**Enhancement Description:** Improve Chat Agent's context management to avoid reading all files on every modification request. Implement smart file selection that passes only relevant file contents to the agent based on the user's request.

**Impact Assessment:** Moderate Impact (some existing code changes)

### 1.5 Goals

- Reduce token usage by 50-70% for typical modification requests
- Eliminate redundant `list_project_files()` and `grep_code()` tool calls
- Provide relevant file contents upfront in the agent context
- Maintain ability to search/read additional files when needed

### 1.6 Background Context

The current Chat Agent design requires multiple tool calls to understand the project before making any changes. For a simple request like "make the header blue", the agent must: (1) list files, (2) grep for "header", (3) read the header component, (4) update it. This is wasteful when we already have all file contents stored in the session.

A smarter context builder could analyze the user's request, score file relevance, and include the most relevant file contents directly in the prompt - reducing a 4-step process to 1 step.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | The system shall analyze user modification requests to identify relevant keywords, file types, and component names before invoking the Chat Agent. |
| FR2 | The system shall score and rank project files by relevance to the user's request using keyword matching, file type priority, and recency of changes. |
| FR3 | The system shall include full content of top-ranked relevant files (up to a configurable token limit) directly in the Chat Agent's context. |
| FR4 | The system shall provide a condensed summary (file path, purpose, exports) for files not included in full, enabling the agent to request them if needed. |
| FR5 | The Chat Agent shall retain access to `read_file`, `grep_code`, and `list_project_files` tools for cases where pre-loaded context is insufficient. |
| FR6 | The system shall track which files the agent modifies per request to improve relevance scoring for future requests in the same session. |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Context building shall complete in under 100ms for projects with up to 50 files. |
| NFR2 | The enhanced context shall reduce average tool calls per modification request by at least 50%. |
| NFR3 | Token usage for typical modification requests (styling, content changes) shall decrease by 40-70%. |
| NFR4 | The system shall not increase memory usage by more than 20% compared to current implementation. |
| NFR5 | All changes must maintain backward compatibility with existing CLI and API interfaces. |

### 2.3 Compatibility Requirements

| ID | Requirement |
|----|-------------|
| CR1 | Existing API endpoints (`/api/sessions/{id}/chat`) shall continue to work without changes to request/response format. |
| CR2 | The `ChatSession` dataclass interface shall remain backward compatible - existing attributes and methods must continue to work. |
| CR3 | Chat Agent prompt structure shall maintain compatibility with current tool definitions. |
| CR4 | Local file backup and E2B sandbox dual-write behavior shall remain unchanged. |

---

## 3. Technical Constraints and Integration Requirements

### 3.1 Existing Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Runtime | Python | 3.12+ | Required by pyproject.toml |
| Framework | FastAPI | 0.115+ | REST API server |
| LLM | LangChain + Anthropic | 1.2+ / 1.3+ | Agent orchestration |
| Model | Claude Haiku | claude-haiku-4-5-20251001 | All agents use this |
| Sandbox | E2B | 1.0+ | Hot reload preview |
| Server | Uvicorn | 0.32+ | ASGI server |

### 3.2 Integration Approach

**Database Integration Strategy:**
- N/A - No database. Session state is in-memory via `SessionManager` class.
- File contents stored in `ChatSession.generated_files: dict[str, str]`

**API Integration Strategy:**
- No changes to API routes in `api.py`
- Enhancement is internal to `ChatSession` and `create_chat_agent()`
- Existing endpoint signatures remain unchanged

**Frontend Integration Strategy:**
- N/A - This is a backend-only enhancement
- CLI (`chat_agent.py`) and API (`api.py`) both use `SessionManager`

**Testing Integration Strategy:**
- Unit tests for new `RelevanceScorer` class
- Integration test: measure tool calls for sample modification requests
- Before/after token usage comparison

### 3.3 Code Organization and Standards

**File Structure Approach:**
```
services/
├── session_manager.py      # Modify: enhance get_context_summary()
├── context_builder.py      # NEW: RelevanceScorer, ContextBuilder classes
├── sandbox_context.py      # No changes
├── sandbox.py              # No changes
prompts/
├── chat_prompt.py          # Modify: update prompt to use rich context
```

**Naming Conventions:**
- Classes: PascalCase (`RelevanceScorer`, `ContextBuilder`)
- Functions: snake_case (`score_file_relevance`, `build_smart_context`)
- Constants: UPPER_SNAKE_CASE (`MAX_CONTEXT_TOKENS`, `FILE_TYPE_PRIORITY`)

**Coding Standards:**
- Type hints required (existing pattern in codebase)
- Dataclasses for data structures (existing pattern)
- Tools decorated with `@tool` from LangChain

### 3.4 Deployment and Operations

**Build Process Integration:**
- No changes - standard `uv sync` for dependencies
- No new dependencies required

**Deployment Strategy:**
- Drop-in replacement - no migration needed
- Feature can be enabled/disabled via config flag if desired

**Monitoring and Logging:**
- Add logging for context build time and file selection
- Log token estimates for context (helps validate NFR3)

**Configuration Management:**
- `MAX_CONTEXT_TOKENS`: Maximum tokens for file contents (default: 4000)
- `MAX_FULL_FILES`: Maximum files to include in full (default: 5)
- `INCLUDE_FILE_SUMMARIES`: Whether to include summaries (default: True)

### 3.5 Risk Assessment and Mitigation

| Risk Type | Risk | Likelihood | Impact | Mitigation |
|-----------|------|------------|--------|------------|
| Technical | Relevance scoring selects wrong files | Medium | Medium | Include file summaries as fallback; agent can still use read_file tool |
| Technical | Context too large, exceeds model limits | Low | High | Hard cap on MAX_CONTEXT_TOKENS; prioritize smaller relevant files |
| Technical | Keyword extraction misses intent | Medium | Low | Simple keyword matching is baseline; can enhance later with better NLP |
| Integration | Changes break existing session behavior | Low | High | Comprehensive tests; maintain backward-compatible interface |
| Performance | Context building adds latency | Low | Medium | Target <100ms; use simple algorithms, no external calls |

---

## 4. Epic and Story Structure

### 4.1 Epic Approach

**Epic Structure Decision:** Single epic with 4 sequential stories.

**Rationale:** This enhancement is a focused improvement to one subsystem (Chat Agent context). All stories build on each other and share the same goal.

---

## Epic 1: Smart Context Management for Chat Agent

**Epic Goal:** Reduce Chat Agent tool calls and token usage by providing intelligently-selected file contents upfront in the agent context.

**Integration Requirements:**
- Must integrate with existing `ChatSession` class
- Must work with both CLI (`chat_agent.py`) and API (`api.py`) entry points
- Must preserve existing tool functionality as fallback

---

### Story 1.1: Create File Relevance Scoring System

**As a** Chat Agent,
**I want** files scored by relevance to the user's request,
**so that** I receive the most useful files first without searching.

**Acceptance Criteria:**

1. `RelevanceScorer` class exists in `services/context_builder.py`
2. `score_file(file_path: str, file_content: str, query: str) -> float` returns 0.0-1.0 score
3. Scoring considers: keyword matches, file type priority (.tsx > .ts > .css), component name matches
4. Page files (`page.tsx`) receive bonus score for route-related queries
5. Recently modified files (tracked per session) receive recency bonus
6. Unit tests verify scoring logic with sample files and queries

**Integration Verification:**

- IV1: Existing `ChatSession` class unchanged - no breaking changes
- IV2: Scorer can be instantiated independently for testing
- IV3: No performance regression - scoring 50 files completes in <50ms

---

### Story 1.2: Build Smart Context Builder

**As a** system,
**I want** to construct optimized context from scored files,
**so that** the Chat Agent receives relevant content within token limits.

**Acceptance Criteria:**

1. `ContextBuilder` class exists in `services/context_builder.py`
2. `build_context(session: ChatSession, query: str, max_tokens: int) -> SmartContext` method works
3. `SmartContext` dataclass contains: `full_files: list[FileContent]`, `summaries: list[FileSummary]`, `token_count: int`
4. Full content included for top-scored files until token budget exhausted
5. Remaining files included as summaries (path, line count, detected purpose)
6. Token counting uses simple estimation (chars/4) - good enough for budget management

**Integration Verification:**

- IV1: `ContextBuilder` accepts standard `ChatSession` object
- IV2: Works with sessions that have 0 files (returns empty context gracefully)
- IV3: Respects `MAX_CONTEXT_TOKENS` configuration

---

### Story 1.3: Integrate Smart Context into Chat Agent

**As a** developer using the Chat Agent,
**I want** the agent to receive smart context automatically,
**so that** I get faster responses with fewer tool calls.

**Acceptance Criteria:**

1. `ChatSession.get_smart_context(query: str)` method added
2. `create_chat_agent()` in `agents.py` updated to use smart context
3. `CHAT_PROMPT_WITH_CONTEXT` updated to format smart context clearly
4. Prompt includes section: "## Relevant Files (Pre-loaded)" with full content
5. Prompt includes section: "## Other Files (Request if needed)" with summaries
6. Existing `get_context_summary()` remains for backward compatibility

**Integration Verification:**

- IV1: CLI (`chat_agent.py`) works with new context - test with sample modification
- IV2: API (`api.py`) works with new context - test `/chat` endpoint
- IV3: Agent can still call `read_file` for files not in pre-loaded context

---

### Story 1.4: Add Metrics and Validation

**As a** system operator,
**I want** to measure the improvement from smart context,
**so that** I can validate the enhancement meets its goals.

**Acceptance Criteria:**

1. Logging added for: context build time, files selected, estimated tokens
2. Test script compares tool calls: before (current) vs after (smart context)
3. Test with 5 representative modification requests documented
4. Results show ≥50% reduction in tool calls for typical requests
5. Results show ≥40% reduction in tokens for typical requests
6. Documentation updated: CLAUDE.md mentions smart context feature

**Integration Verification:**

- IV1: All existing functionality still works (regression test)
- IV2: Logging doesn't impact performance (<5ms overhead)
- IV3: Metrics can be disabled via config if too verbose

---

## Story Dependency Graph

```
Story 1.1 (Scoring) ──► Story 1.2 (Builder) ──► Story 1.3 (Integration) ──► Story 1.4 (Validation)
     │                        │                        │                         │
     └── Foundation           └── Uses Scorer          └── Uses Builder          └── Proves value
```

---

## Appendix: Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `services/context_builder.py` | CREATE | New file with `RelevanceScorer`, `ContextBuilder`, `SmartContext` |
| `services/session_manager.py` | MODIFY | Add `get_smart_context()` method to `ChatSession` |
| `prompts/chat_prompt.py` | MODIFY | Update `CHAT_PROMPT_WITH_CONTEXT` for rich context format |
| `agents.py` | MODIFY | Update `create_chat_agent()` to use smart context |
| `chat_agent.py` | MODIFY | Pass user query to context builder |
| `CLAUDE.md` | MODIFY | Document smart context feature |
