---
name: shadcn-components
description: Use shadcn/ui components correctly. CRITICAL - SelectItem value must be non-empty string. Use when working with Button, Card, Dialog, Select, or other shadcn components.
category: frontend
agents: [coder, chat]
---

## When to Use
- Using any shadcn/ui component
- Creating forms with Select components
- Building dialogs, cards, or modals
- Importing from @/components/ui/*

## Instructions

### Available Components

Import from `@/components/ui/*`:
- button, card, input, label, select, dialog, dropdown-menu, checkbox
- tabs, badge, avatar, separator, scroll-area, skeleton, switch, textarea

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

### Button Component

```tsx
import { Button } from "@/components/ui/button"

// Variants
<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// With loading state
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </>
  ) : (
    'Submit'
  )}
</Button>
```

### Card Component

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

<Card className="bg-[var(--color-surface)]">
  <CardHeader>
    <CardTitle className="text-[var(--color-text)]">Card Title</CardTitle>
    <CardDescription className="text-[var(--color-muted)]">Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Input + Label

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>
```

### Dialog Component

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        This is a description of what the dialog is for.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      {/* Dialog content */}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleSubmit}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Tabs Component

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="account">
    <p>Account settings here</p>
  </TabsContent>
  <TabsContent value="settings">
    <p>General settings here</p>
  </TabsContent>
</Tabs>
```

### Badge Component

```tsx
import { Badge } from "@/components/ui/badge"

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Destructive</Badge>
```

### Checkbox + Switch

```tsx
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

// Checkbox
<div className="flex items-center gap-2">
  <Checkbox id="terms" checked={agreed} onCheckedChange={setAgreed} />
  <Label htmlFor="terms">Accept terms</Label>
</div>

// Switch
<div className="flex items-center gap-2">
  <Switch id="notifications" checked={enabled} onCheckedChange={setEnabled} />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

### Dropdown Menu

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleDelete} className="text-red-500">
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Utility: cn() Function

Always import cn from lib/utils for conditional classes:

```tsx
import { cn } from "@/lib/utils"

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "outline" && "outline-classes"
)}>
```

### RULES

1. **SelectItem value MUST be non-empty** — use "none" for optional selections
2. **Always filter dynamic arrays** before mapping to SelectItems
3. **Import from @/components/ui/** — not from radix directly
4. **Use asChild on triggers** — when wrapping custom elements
5. **Use cn() for conditional classes** — import from @/lib/utils
6. **Don't overwrite lib/utils.ts** — it contains the cn function
