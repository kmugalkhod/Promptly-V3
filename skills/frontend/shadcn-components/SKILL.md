---
name: shadcn-components
description: Use shadcn/ui components correctly. CRITICAL - SelectItem value must be non-empty string. All components are PRE-INSTALLED — just import them, never recreate.
category: frontend
agents: [coder, chat]
---

## When to Use
- Using any shadcn/ui component
- Creating forms with Select components
- Building dialogs, cards, or modals
- Need to know what components are available

## Instructions

### ALL Components Are PRE-INSTALLED

The sandbox template installs ALL shadcn/ui components. **DO NOT create files in components/ui/**.
Just import what you need:

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
```

`lib/utils.ts` with the `cn()` function is also pre-installed. Do NOT recreate it.

### Styling with Tailwind Theme Classes

Components automatically use the app's design tokens via Tailwind theme classes:

| Purpose | Tailwind Class | Maps to CSS Variable |
|---------|---------------|---------------------|
| Primary background | `bg-primary` | `--primary` |
| Primary text | `text-primary` | `--primary` |
| Text on primary bg | `text-primary-foreground` | `--primary-foreground` |
| Page background | `bg-background` | `--background` |
| Main text | `text-foreground` | `--foreground` |
| Card background | `bg-card` | `--card` |
| Card text | `text-card-foreground` | `--card-foreground` |
| Muted background | `bg-muted` | `--muted` |
| Subtle text | `text-muted-foreground` | `--muted-foreground` |
| Accent background | `bg-accent` | `--accent` |
| Border | `border-border` | `--border` |
| Destructive | `bg-destructive` | `--destructive` |

**NEVER use explicit CSS variable syntax (e.g., bg-[var(--varname)]). Use the Tailwind theme classes above.**

### ⚠️ Select Component (CRITICAL - VIOLATIONS CRASH THE APP)

The Select component has strict rules that MUST be followed:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ✅ CORRECT - Static options with non-empty values
<Select value={status} onValueChange={setStatus}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="todo">To Do</SelectItem>
    <SelectItem value="in-progress">In Progress</SelectItem>
    <SelectItem value="done">Done</SelectItem>
  </SelectContent>
</Select>
```

**5 SELECT RULES (memorize these):**

| Rule | Wrong | Correct |
|------|-------|---------|
| 1. Never empty value | `value=""` | `value="none"` |
| 2. Use "none" for optional | `value=""` | `value="none"` |
| 3. Filter empty IDs | `item?.id` | `.filter(item => item.id && item.id.trim() !== "")` |
| 4. No optional chaining | `value={item?.id}` | `value={item.id}` |
| 5. Use fallback | `value={item.id}` | `value={item.id \|\| "none"}` |

**Dynamic options with validation:**

```tsx
// ✅ CORRECT - Filter and validate before mapping
<Select value={epicId || "none"} onValueChange={setEpicId}>
  <SelectTrigger>
    <SelectValue placeholder="Select epic" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">No Epic</SelectItem>
    {epics.filter(epic => epic.id && epic.id.trim() !== "").map(epic => (
      <SelectItem key={epic.id} value={epic.id}>{epic.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### RULES

1. **NEVER create files in components/ui/** — they are pre-installed
2. **NEVER recreate lib/utils.ts** — it's pre-installed with cn()
3. **SelectItem value MUST be non-empty** — use "none" for optional selections
4. **Always filter dynamic arrays** before mapping to SelectItems
5. **Import from @/components/ui/** — not from radix directly
6. **Use asChild on triggers** — when wrapping custom elements
7. **Use cn() for conditional classes** — import from @/lib/utils
8. **Use Tailwind theme classes** — bg-primary, text-foreground, bg-card, etc.
