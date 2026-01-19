'use client'

import { Checkbox as UICheckbox } from '@/components/ui/checkbox'

interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
}

export function Checkbox({ checked, onCheckedChange, id }: CheckboxProps) {
  return (
    <UICheckbox
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="h-5 w-5"
    />
  )
}
