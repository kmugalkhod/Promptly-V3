---
name: form-builder
description: Build forms with react-hook-form and zod validation. Use when creating forms, input validation, or form submission handling.
category: frontend
agents: [coder, chat]
---

## When to Use
- Creating forms with validation
- Handling form submission
- Building multi-step forms
- Input validation with error display

## Instructions

### Basic Form Pattern (react-hook-form + zod)

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 1. Define schema
const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type FormData = z.infer<typeof formSchema>

// 2. Create form component
export function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    console.log(data)
    // API call here
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          {...register('message')}
          className="w-full p-2 border rounded-md"
          rows={4}
        />
        {errors.message && (
          <p className="text-sm text-red-500">{errors.message.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  )
}
```

### Common Zod Schema Patterns

```tsx
import { z } from 'zod'

// String validations
const stringSchema = z.object({
  required: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  url: z.string().url('Invalid URL'),
  minLength: z.string().min(5, 'Must be at least 5 characters'),
  maxLength: z.string().max(100, 'Must be at most 100 characters'),
  regex: z.string().regex(/^[A-Z]/, 'Must start with uppercase'),
})

// Number validations
const numberSchema = z.object({
  positive: z.number().positive('Must be positive'),
  range: z.number().min(1).max(100),
  integer: z.number().int('Must be a whole number'),
})

// Optional fields
const optionalSchema = z.object({
  optional: z.string().optional(),
  nullable: z.string().nullable(),
  withDefault: z.string().default('default value'),
})

// Enum/select fields
const enumSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  role: z.enum(['admin', 'user', 'guest']),
})

// Password with confirmation
const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})
```

### Select Field Pattern (with react-hook-form)

```tsx
'use client'

import { Controller, useForm } from 'react-hook-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FormData {
  category: string
}

export function SelectForm() {
  const { control, handleSubmit } = useForm<FormData>()

  return (
    <form onSubmit={handleSubmit(console.log)}>
      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tech">Technology</SelectItem>
              <SelectItem value="health">Health</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Simple Form (without react-hook-form)

For simple forms, useState is sufficient:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SimpleForm() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.length < 2) {
      setError('Name must be at least 2 characters')
      return
    }
    setError('')
    console.log('Submitted:', name)
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name"
        />
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Error Display Pattern

```tsx
// Inline error below input
{errors.fieldName && (
  <p className="text-sm text-red-500 mt-1">{errors.fieldName.message}</p>
)}

// Error with icon
{errors.fieldName && (
  <div className="flex items-center gap-2 text-red-500 text-sm mt-1">
    <AlertCircle className="h-4 w-4" />
    <span>{errors.fieldName.message}</span>
  </div>
)}

// Error styling on input
<Input
  {...register('email')}
  className={errors.email ? 'border-red-500 focus:ring-red-500' : ''}
/>
```

### Form with Loading State

```tsx
const [isLoading, setIsLoading] = useState(false)

const onSubmit = async (data: FormData) => {
  setIsLoading(true)
  try {
    await submitToAPI(data)
    reset()
  } catch (error) {
    console.error(error)
  } finally {
    setIsLoading(false)
  }
}

<Button type="submit" disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Submitting...
    </>
  ) : (
    'Submit'
  )}
</Button>
```

### Required Packages

If using react-hook-form:
```
react-hook-form @hookform/resolvers zod
```

### RULES

1. Always add `'use client'` for form components
2. Use zod for validation when form has multiple fields
3. Use useState for simple single-field forms
4. Always show validation errors near the input
5. Disable submit button during submission
6. Clear form after successful submission
