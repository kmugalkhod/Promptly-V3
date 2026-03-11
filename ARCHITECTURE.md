# Promptly V3 — Architecture Document

## Project Overview

Promptly V3 is an AI-powered web application builder that uses a three-agent system (Architecture → Schema → Coder) to generate full-stack Next.js applications from natural language descriptions. It features live preview via E2B sandboxes, Supabase database integration, and a skills-based agent architecture for progressive knowledge disclosure.

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.3 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS v4 | 4.x |
| UI Components | shadcn/ui (Radix primitives) | 1.4.3 |
| Backend | Convex (real-time DB + serverless) | 1.31.5 |
| AI Framework | LangChain + Anthropic | 1.2.10 / 1.3.10 |
| Sandbox | E2B | 2.10.2 |
| Database | Supabase (PostgreSQL + RLS) | Cloud |
| Animation | motion | 12.34.2 |
| Icons | lucide-react | 0.562.0 |
| Export | jszip | 3.10.1 |
| Skills Parsing | gray-matter | 4.0.3 |

---

## 2. Project Structure

```
promptly-v3/
├── app/                    # Next.js App Router (routes, layouts, API)
├── components/             # React components (chat, preview, modals, layout, UI)
├── convex/                 # Convex backend (schema, queries, mutations, actions)
├── hooks/                  # Custom React hooks
├── lib/                    # Business logic, agents, utilities, prompts
├── public/                 # Static assets
├── scripts/                # Build and verification scripts
├── skills/                 # Modular SKILL.md files organized by category
├── types/                  # TypeScript type definitions
├── convex.json             # Convex project config
├── tsconfig.json           # TypeScript config
├── next.config.ts          # Next.js config
├── postcss.config.mjs      # PostCSS (Tailwind v4)
├── tailwind.config.ts      # Tailwind config
└── package.json            # Dependencies and scripts
```

---

## 3. App Router & Routes

```
app/
├── page.tsx                          # Root → redirects to /builder
├── layout.tsx                        # Root layout (ConvexProvider, fonts, dark mode)
├── globals.css                       # Global styles + design tokens
├── builder/
│   ├── layout.tsx                    # Builder layout (AppShell sidebar + content)
│   ├── page.tsx                      # Welcome experience (new project prompt)
│   └── [sessionId]/
│       └── page.tsx                  # Active builder session (chat + preview)
└── api/auth/supabase/
    ├── callback/route.ts             # OAuth callback handler
    ├── token/route.ts                # Token exchange
    ├── refresh/route.ts              # Token refresh
    ├── organizations/route.ts        # Fetch user organizations
    ├── projects/route.ts             # Fetch Supabase projects
    ├── create-project/route.ts       # Create new Supabase project
    └── execute-sql/route.ts          # Execute SQL via Management API
```

### Layout Hierarchy

1. **Root Layout** — Wraps entire app with `ConvexClientProvider`, sets dark mode, loads Geist fonts
2. **Builder Layout** — Wraps builder routes with `AppShell` (sidebar + main content area)
3. **Session Page** — Split-pane: ChatPanel (left) + Preview/CodeEditor (right)

---

## 4. Component Architecture

```
components/
├── chat/
│   ├── ChatPanel.tsx               # Main chat container + orchestration
│   ├── MessageList.tsx             # Message display with auto-scroll
│   ├── MessageInput.tsx            # User input area
│   └── StreamingMessage.tsx        # Real-time streaming display
├── explorer/
│   ├── FileExplorer.tsx            # File browser tree
│   └── FileTreeNode.tsx            # Individual file node
├── layout/
│   ├── AppShell.tsx                # Sidebar + content layout
│   ├── AppSidebar.tsx              # Sidebar navigation
│   └── Header.tsx                  # Top header bar
├── preview/
│   ├── Preview.tsx                 # Iframe preview with responsive controls
│   ├── CodeEditor.tsx              # Monaco editor for code viewing
│   ├── RightPanel.tsx              # File explorer + editor container
│   ├── SandboxStatus.tsx           # Sandbox connection status
│   ├── GenerationAnimation.tsx     # Phase animation during generation
│   ├── PreviewLoading.tsx          # Loading skeleton
│   └── PreviewError.tsx            # Error display
├── modals/
│   ├── SupabaseIntegrationPanel.tsx # Database connection UI + OAuth
│   ├── ManualConnectionForm.tsx     # Manual Supabase connection
│   ├── ProjectCreationForm.tsx      # Create Supabase project
│   ├── SettingsModal.tsx            # Project settings
│   └── DownloadModal.tsx            # Export project as ZIP
├── welcome/
│   └── WelcomeExperience.tsx        # Initial prompt input screen
└── ui/                              # shadcn/ui components (auto-generated)
    ├── button.tsx, input.tsx, dialog.tsx, dropdown-menu.tsx
    ├── sidebar.tsx, badge.tsx, avatar.tsx, tabs.tsx
    └── scroll-area.tsx, skeleton.tsx, tooltip.tsx, ...
```

---

## 5. State Management

### Backend State (Convex — real-time sync)

All persistent state lives in Convex collections with real-time subscriptions:

- `api.sessions.get()` — Session metadata, Supabase connection, architecture
- `api.messages.listBySession()` — Chat history
- `api.files.listBySession()` — Generated code files
- `api.sessions.getSupabaseStatus()` — Database connection status

### Client State (React hooks — ephemeral)

Managed via `useState` in `ChatPanel` and `[sessionId]/page.tsx`:

| State | Type | Purpose |
|-------|------|---------|
| `isProcessing` | boolean | Generation in progress |
| `generationStage` | enum | Current phase (architecture / schema / coder / complete) |
| `selectedFilePath` | string | Currently viewed file in editor |
| `sandboxStatus` | enum | Sandbox connection (idle / initializing / ready / error) |
| `isDownloadModalOpen` | boolean | Modal visibility |
| `isSettingsModalOpen` | boolean | Modal visibility |

**No external state library** — Direct Convex queries + React hooks pattern.

---

## 6. Convex Backend

### Database Schema

Four primary collections defined in `convex/schema.ts`:

**sessions** — Project metadata
- `appName`, `status`, `sandboxId`, `previewUrl`
- `architecture` (full architecture.md content)
- Supabase connection fields (URL, keys, tokens, project ref)
- Schema execution status (`schemaStatus`, `schemaError`, `schemaTablesCreated`)
- Coder validation state (`coderStatus`, `coderError`, `coderRetryCount`)

**messages** — Chat history
- `sessionId`, `role` (user/assistant), `content`
- Indexed by `sessionId + createdAt`

**files** — Generated code files
- `sessionId`, `path`, `content`, `createdAt`, `updatedAt`

**fileEmbeddings** — Vector search
- 1536-dimensional vectors (OpenAI ada-002 compatible)
- Metadata: file type, exported names, import count
- Vector index for semantic code search

### Queries & Mutations

| Module | Key Functions |
|--------|--------------|
| `sessions.ts` | `create`, `get`, `list`, `update`, `updateInternal` |
| `messages.ts` | `create`, `listBySession`, `getRecent`, `createInternal` |
| `files.ts` | `upsert`, `listBySession`, `getByPath` |

### Actions (Serverless)

| Action | Purpose |
|--------|---------|
| `generate.generate()` | Full pipeline: Architecture → Schema → Coder |
| `generate.modify()` | Chat Agent for code modifications |
| `generate.regenerate()` | Re-run generation with error feedback |
| `sandbox.initializeForSession()` | Create sandbox, restore files, start dev server |
| `sandbox.recreate()` | Rebuild sandbox from Convex files |
| `sandbox.extendTimeout()` | Keep sandbox alive |
| `sandbox.writeFile()` | Write to sandbox + backup to Convex |
| `sessions.connectSupabase()` | OAuth token exchange |
| `sessions.executeSupabaseSchema()` | Execute SQL via Management API |

---

## 7. AI Agent System

### Three-Agent Pipeline

```
User Prompt
     │
     ▼
┌─────────────────┐
│ Architecture     │  Claude Sonnet 4.6
│ Agent            │  Output: architecture.md
│                  │  Skills: app-structure, route-planning,
│                  │          design-system, data-modeling, typography
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Schema Agent     │  Claude Sonnet 4.6 (optional, if DB needed)
│                  │  Output: schema.sql (PostgreSQL + RLS)
│                  │  Skills: rls-policies, database-queries
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Coder Agent      │  Claude Sonnet 4.6
│                  │  Output: Full Next.js app (components, pages, styles)
│                  │  Tools: write_file, update_file, read_file, install_packages
│                  │  Skills: All frontend + shared skills
│                  │  Recursion limit: 150 (self-healing validation loop)
└─────────────────┘
```

### Chat Agent (Modifications)

```
User Modification Request
     │
     ▼
┌─────────────────┐
│ Chat Agent       │  Claude Sonnet 4.6
│                  │  Input: user message + smart file context
│                  │  Output: Code modifications
│                  │  Tools: read_file, write_file, update_file
│                  │  Skills: add-feature, fix-bug, edit-component, etc.
│                  │  Recursion limit: 15
└─────────────────┘
```

### Agent Execution Details

All agents use:
- **LangChain Framework** — `createAgent`, tool definitions, streaming
- **Anthropic API** — Claude Sonnet 4.6 with prompt caching
- **Tool Execution Loop** — Agent calls tools → gets results → continues
- **Progressive Skill Loading** — Metadata upfront, full content on-demand via `load_skill` tool

### Smart Context (Chat Agent)

When handling modifications, the Chat Agent:
1. Scores all session files by relevance to the user query
2. Includes top 5 files with full content
3. Includes summaries for next 10 files
4. Respects blocked file list (config files cannot be modified)

### Blocked Files (Chat Agent)

The Chat Agent cannot modify:
- `tailwind.config.ts/js`, `postcss.config.js/mjs`
- `next.config.js/mjs/ts`
- `package.json`, `package-lock.json`
- `tsconfig.json`
- `lib/utils.ts`
- `.env.local`, `.env.local.example`

---

## 8. Skills System

### Structure

Skills are modular instruction sets stored as SKILL.md files with YAML frontmatter:

```
skills/
├── architecture/     # 5 skills — Architecture Agent
│   ├── app-structure/SKILL.md
│   ├── route-planning/SKILL.md
│   ├── design-system/SKILL.md
│   ├── data-modeling/SKILL.md
│   └── typography/SKILL.md
├── chat/             # 7 skills — Chat Agent
│   ├── add-feature/SKILL.md
│   ├── edit-component/SKILL.md
│   ├── fix-bug/SKILL.md
│   ├── modify-schema/SKILL.md
│   ├── debug-visual-issues/SKILL.md
│   ├── explain-code/SKILL.md
│   └── understand-request/SKILL.md
├── frontend/         # 11 skills — Coder/Chat Agents
│   ├── react-component/SKILL.md
│   ├── state-management/SKILL.md
│   ├── responsive-design/SKILL.md
│   ├── shadcn-components/SKILL.md
│   ├── animation/SKILL.md
│   ├── form-builder/SKILL.md
│   ├── client-server/SKILL.md
│   ├── layout-grid/SKILL.md
│   ├── localstorage-persistence/SKILL.md
│   ├── hydration-safety/SKILL.md
│   └── ...
├── shared/           # 2 skills — All agents
│   ├── nextjs-patterns/SKILL.md
│   └── tailwind-v4/SKILL.md
└── supabase/         # 3 skills — Database work
    ├── auth-setup/SKILL.md
    ├── database-queries/SKILL.md
    └── rls-policies/SKILL.md
```

**Total: 27 skills** (5 architecture + 7 chat + 11 frontend + 2 shared + 3 supabase)

### Two-Stage Loading

1. **Metadata Loading** (`getSkillsMetadata()`) — Scans `/skills`, parses YAML frontmatter, cached in memory
2. **Full Content Loading** (`loadSkill(name)`) — Agent calls `load_skill` tool during execution for full instructions

### Fallback Bundle

`lib/agents/skills-bundle.ts` — Pre-bundled skills for Convex cloud where filesystem is unavailable. Generated by `npx tsx scripts/bundle-skills.ts`.

---

## 9. Supabase Integration

### Purpose

Supabase provides PostgreSQL database with Row-Level Security (RLS) for generated apps that need data persistence.

### OAuth 2.1 PKCE Flow

```
1. User clicks "Connect Supabase"
     │
2. Generate PKCE challenge (code_verifier + code_challenge)
     │
3. Redirect to Supabase authorization
     │
4. User approves → callback with code + state
     │
5. Token exchange → access_token + refresh_token
     │
6. Tokens stored in Convex session
     │
7. SQL execution via Supabase Management API
```

### Connection Storage (Session Fields)

| Field | Purpose |
|-------|---------|
| `supabaseUrl` | Project URL |
| `supabaseAnonKey` | Client-side anon key |
| `supabaseAccessToken` | Management API token |
| `supabaseProjectRef` | Project ID |
| `supabaseRefreshToken` | OAuth refresh token |
| `supabaseTokenExpiry` | Token expiration |
| `supabaseConnected` | Connection flag |

### Schema Execution Pipeline

1. Database section extracted from `architecture.md`
2. Schema Agent generates SQL with RLS policies
3. SQL executed via Supabase Management API
4. PostgREST cache reloaded
5. Health check verifies tables created
6. Status stored in session

### Allowed SQL Operations

`CREATE`, `ALTER`, `DROP`, `INSERT`, `SELECT`, `GRANT`, `SET`, `BEGIN`, `COMMIT`, `DO $$`, comments

---

## 10. E2B Sandbox System

### Template

`nextjs16-tailwind4` — Pre-configured environment with Next.js 16 + Tailwind v4 + shadcn/ui

### Lifecycle

```
1. CREATE → Spin up E2B instance (timeout: 900s)
     │
2. RESTORE → Read all files from Convex → write to sandbox
     │
3. INSTALL → npm install (--legacy-peer-deps fallback)
     │
4. START → npm run dev → hot-reloadable server
     │
5. PREVIEW → Accessible at sandbox preview URL in iframe
     │
6. HOT RELOAD → Agent writes file → Next.js rebuilds → instant preview
     │
7. RECREATE → If needed, kill + create new + restore files
```

### File Operations

| Operation | Flow |
|-----------|------|
| **Write** | Agent → E2B sandbox → hot reload → backup to Convex |
| **Read** | Check context cache → fallback to Convex → return to agent |

---

## 11. Styling & Design System

### Dark Mode Only

App is hardcoded to `className="dark"` — zinc + violet color scheme, no light mode.

### Design Tokens (CSS Custom Properties)

```css
:root {
  --background: #09090b;        /* zinc-950 */
  --foreground: #fafafa;
  --card: #18181b;              /* zinc-900 */
  --primary: #7c3aed;          /* violet-600 */
  --secondary: #27272a;        /* zinc-800 */
  --muted: #27272a;
  --destructive: #ef4444;

  /* Glassmorphism */
  --glass-bg: rgba(24, 24, 27, 0.8);
  --glass-border: rgba(63, 63, 70, 0.3);
  --glass-blur: 12px;
}
```

### shadcn/ui Components

Auto-generated in `components/ui/`: button, input, textarea, dialog, dropdown-menu, sheet, sidebar, badge, avatar, checkbox, switch, tabs, scroll-area, skeleton, tooltip, separator.

---

## 12. Data Flow

### New Project: User Prompt → Live Preview

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                                                              │
│  WelcomeExperience → ChatPanel → MessageInput                │
│         │                                                    │
│         ▼                                                    │
│  Create Session (Convex mutation)                            │
│  Save User Message (Convex mutation)                         │
│  Set generationStage = "architecture"                        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    CONVEX ACTIONS                             │
│                                                              │
│  generate.generate()                                         │
│    ├── 1. Architecture Agent → architecture.md               │
│    ├── 2. Schema Agent → schema.sql (if DB needed)           │
│    ├── 3. Create E2B Sandbox                                 │
│    ├── 4. Coder Agent → write files to sandbox               │
│    │      └── Self-healing loop (up to 3 retries)            │
│    └── 5. Save all files to Convex                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    E2B SANDBOX                                │
│                                                              │
│  /home/user/                                                 │
│    ├── app/ (pages, layouts, globals.css)                     │
│    ├── components/ (generated components)                    │
│    ├── package.json (with installed deps)                     │
│    └── Next.js dev server (hot reload)                       │
│                                                              │
│  Preview URL → iframe in browser                             │
└──────────────────────────────────────────────────────────────┘
```

### Modification: Chat Message → Code Update

```
User Message → ChatPanel
     │
     ▼
Save message → Convex
     │
     ▼
generate.modify()
     │
     ├── Build smart context (score files by relevance)
     ├── Chat Agent processes with context
     ├── Agent calls read_file / write_file / update_file
     ├── Changes written to E2B sandbox → hot reload
     └── Files backed up to Convex
     │
     ▼
Preview updates in iframe (instant)
```

---

## 13. Generation Phases & Error Recovery

### Phase Tracking

| Phase | Status Values | Description |
|-------|--------------|-------------|
| Session | `new` → `active` → `archived` | Overall session state |
| Generation | `architecture` → `schema` → `coder` → `complete` | Current generation phase |
| Schema Execution | `pending` → `validating` → `executing` → `success`/`error` | SQL execution status |
| Coder Validation | `generating` → `validating` → `fixing` → `success`/`error` | Code validation status |

### Self-Healing Loop (Coder Agent)

```
Generate Code → Validate → Errors?
                              │
                    ┌─────────┴─────────┐
                    │ No                 │ Yes
                    ▼                    ▼
                 Success           Format retry prompt
                                   with error details
                                         │
                                         ▼
                                   Regenerate (up to 3 retries)
                                         │
                                         ▼
                                   Validate again...
```

### Code Preservation Rules (Chat Agent)

When modifying existing code, the Chat Agent must:
1. Always read the FULL file before writing
2. Keep ALL existing imports, functions, styles, state, and components
3. Only add/modify the specifically requested change
4. Never remove code unless explicitly asked

---

## 14. Authentication

### Current State

**No end-user authentication** — all sessions are ephemeral and anonymous.

### Supabase OAuth

PKCE OAuth flow is used exclusively for connecting to the Supabase Management API. Tokens are stored server-side in Convex sessions.

---

## 15. Configuration

### tsconfig.json
- Target: ES2017, Module: esnext, JSX: react-jsx
- Path alias: `@/*` → project root

### next.config.ts
- Minimal configuration (no special overrides)

### Scripts

```bash
npm run dev                            # Next.js + Convex dev server
npm run build                          # Production build
npm run lint                           # ESLint
npx tsc --noEmit                       # Type checking
npx tsx scripts/bundle-skills.ts       # Generate skills bundle
npx tsx scripts/verify-skills.ts       # Verify skills integrity
```

---

## 16. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Convex over traditional DB** | Real-time subscriptions, serverless functions, zero-config backend |
| **Three-agent pipeline** | Separation of concerns: design → schema → implementation |
| **Skills system** | Progressive disclosure keeps prompts focused; agents load only what they need |
| **E2B sandboxes** | Isolated execution environment with hot reload for live preview |
| **Claude Sonnet 4.6 for all agents** | Upgraded from Haiku — code quality was too low with smaller models |
| **Dark mode only** | Simplified design system; matches developer tool aesthetic |
| **No client state library** | Convex real-time queries replace Redux/Zustand for backend state |
| **Blocked files in Chat Agent** | Prevents agents from breaking config files during modifications |
| **PKCE OAuth for Supabase** | Secure token exchange without exposing secrets client-side |

---

## 17. Architecture Diagram (High-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Chat Panel   │  │  Preview     │  │  File Explorer +       │ │
│  │  (Messages,   │  │  (iframe to  │  │  Code Editor           │ │
│  │   Input)      │  │   E2B URL)   │  │  (Monaco)              │ │
│  └──────┬───────┘  └──────────────┘  └────────────────────────┘ │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │ Convex real-time subscriptions
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CONVEX BACKEND                              │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Sessions │  │ Messages │  │  Files   │  │ File Embeddings│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   ACTIONS (Serverless)                    │   │
│  │  generate() │ modify() │ sandbox.*() │ connectSupabase() │   │
│  └──────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   Anthropic API  │ │  E2B Sandbox │ │  Supabase API    │
│   (Claude 4.6)   │ │  (Next.js    │ │  (PostgreSQL     │
│                  │ │   runtime)   │ │   + RLS)         │
│  Architecture    │ │              │ │                  │
│  Schema          │ │  Hot Reload  │ │  Schema Exec     │
│  Coder           │ │  Preview URL │ │  Token Exchange  │
│  Chat            │ │  File I/O    │ │  Health Check    │
└──────────────────┘ └──────────────┘ └──────────────────┘
```
