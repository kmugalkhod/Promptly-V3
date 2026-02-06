---
name: explain-code
description: Explain code to users in plain English. Use when user asks "how does this work", "what does this do", or "explain" about their code.
category: chat
agents: [chat]
---

## When to Use
- User asks "how does this work?"
- User asks "what does this code do?"
- User asks "explain" about a component or pattern
- User asks "why" about an implementation choice

## Instructions

### Explanation Approach

1. **Read the relevant file(s)** — use read_file to get current code
2. **DO NOT modify any code** — explanation only
3. **Explain in plain English** — avoid jargon, be clear
4. **Structure your explanation**:
   - What the component/function does (high level)
   - How it works (key parts)
   - Why it's structured that way (if relevant)

### Explanation Format

Keep explanations concise and structured:
- Start with a one-sentence summary
- Break down key parts
- Highlight any patterns or conventions used
- Note any dependencies or related files

### RULES
- NEVER modify files when explaining
- Read ALL relevant files before explaining
- Be concise — users want understanding, not lectures
- Point out important patterns (state management, data flow)
