# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js Website Generator using a multi-agent architecture powered by LangChain and Anthropic Claude. The system takes user requirements as input and generates complete Next.js applications through a two-phase workflow with E2B sandbox integration for live hot reload preview.

## Commands

```bash
# Install dependencies
uv sync

# Run the CLI workflow (single generation)
python agent.py

# Run the REST API server (multi-session, chat-based)
uvicorn api:app --reload --port 8000

# The generated app runs automatically in E2B with hot reload
# Local backup is saved to generated_apps/<app-name>/
```

## Environment Variables

Required in `.env`:
- `ANTHROPIC_API_KEY` - For Claude API access
- `E2B_API_KEY` - For E2B sandbox (hot reload preview)

## Architecture

### Two Entry Points

1. **CLI Mode** (`agent.py`) - Single-shot generation workflow
2. **API Mode** (`api.py`) - Multi-session REST API with chat interface

### Three-Agent System

All agents use Claude Haiku (`claude-haiku-4-5-20251001`) via LangChain:

1. **Architecture Agent** (`agents.py:create_architecture_agent`)
   - Designs minimal app structure following ARCHITECTURE_PROMPT guidelines
   - Outputs `architecture.md` with app name, routes, components, and design style
   - Tools: `write_file` only

2. **Coder Agent** (`agents.py:create_coder_agent`)
   - Implements the architecture in the E2B sandbox
   - Files trigger instant hot reload preview
   - Tools: `read_file`, `write_file`, `update_file`, `install_packages`

3. **Chat Agent** (`agents.py:create_chat_agent`)
   - Handles modifications to existing projects
   - Receives smart context with pre-loaded relevant files
   - Tools: `read_file`, `write_file`, `update_file`, `grep_code`, `list_project_files`, `install_packages`

### Smart Context for Chat Agent

The Chat Agent uses intelligent context building to reduce tool calls and improve response time:

**How it works:**
1. When you send a modification request, the system analyzes your message
2. Files are scored by relevance (keywords, file type, component names, recency)
3. Most relevant files (up to 5) are included directly in the agent's context
4. Less relevant files are summarized (path, line count, purpose)

**Scoring signals:**
- Keyword matches (40%) - Words from your request found in file content
- File type priority (25%) - `.tsx` > `.ts` > `.css` > other
- Component name match (20%) - e.g., "header" in query matches `Header.tsx`
- Route bonus (10%) - Page files prioritized for route-related queries
- Recency bonus (5%) - Recently modified files get slight boost

**Configuration (in `services/context_builder.py`):**
- `MAX_CONTEXT_TOKENS = 4000` - Maximum tokens for file contents
- `MAX_FULL_FILES = 5` - Maximum files to include in full
- `MIN_SCORE_THRESHOLD = 0.1` - Minimum relevance score to include

**Benefits:**
- ~77% reduction in tool calls (4.4 -> 1 on average)
- Faster responses (fewer round-trips)
- Agent still has access to `read_file` for additional files if needed

**Benchmark (run with `python scripts/benchmark_context.py`):**
| Query Type | Tool Calls Before | After | Reduction |
|------------|-------------------|-------|-----------|
| Styling change | 4 | 1 | 75% |
| Content update | 4 | 1 | 75% |
| Small feature | 5 | 1 | 80% |
| Bug fix | 4 | 1 | 75% |
| Navigation update | 5 | 1 | 80% |

### E2B Sandbox Integration

- **Template**: `nextjs16-tailwind4` (Next.js 16 + Tailwind CSS v4 + shadcn/ui)
- **Project directory**: `/home/user`
- **Dev server**: Auto-starts on port 3000 with hot reload
- **Sandbox timeout**: 10 minutes (600 seconds)
- **Auto-recovery**: If sandbox times out, `SandboxContext.recover_sandbox()` recreates it and restores files from local backup

### Dual-Write Architecture

Files are written in this order:
1. **E2B Sandbox first** - Triggers Next.js hot reload for instant preview
2. **Local backup second** - Saves to `generated_apps/{app_name}/` for persistence

### Key Files

- `agent.py` - CLI workflow orchestrator
- `api.py` - FastAPI REST API with session management
- `agents.py` - Agent factory functions
- `tools.py` - LangChain tools with SandboxContext support
- `schemas.py` - Pydantic models for API requests/responses
- `prompts/` - System prompts (architecture, coder, chat)
- `services/sandbox.py` - E2B SandboxService for sandbox lifecycle
- `services/sandbox_context.py` - SandboxContext for dual-write operations
- `services/session_manager.py` - ChatSession and SessionManager for API mode
- `services/context_builder.py` - Smart context building with relevance scoring
- `utils.py` - App name extraction/validation
- `scripts/benchmark_context.py` - Benchmark script for smart context feature

### REST API Endpoints

Sessions: `POST/GET /api/sessions`, `GET/DELETE /api/sessions/{id}`
Chat: `POST /api/sessions/{id}/chat`, `GET /api/sessions/{id}/messages`
Files: `GET /api/sessions/{id}/files`, `GET /api/sessions/{id}/files/{path}`
Preview: `GET /api/sessions/{id}/preview`
Health: `GET /health`

### Package Whitelist

The `install_packages` tool only allows packages from `tools.py:ALLOWED_PACKAGES`. Key categories:
- Games: phaser, pixi.js
- Charts: recharts, @tremor/react, d3
- Animation: framer-motion, gsap
- Forms: react-hook-form, zod
- State: zustand, @tanstack/react-query
- 3D: three, @react-three/fiber

### Next.js Generation Conventions

- Uses App Router without `src/` directory
- Path pattern: `app/[route]/page.tsx`
- Components: `components/Name.tsx`
- Utilities: `lib/utils.ts` (DO NOT overwrite - has cn function)
- Types: `types/index.ts`
- Client components require `"use client"` directive
- Dynamic routes must await params: `const { id } = await params;`
- shadcn/ui components: `import { Button } from "@/components/ui/button"`
