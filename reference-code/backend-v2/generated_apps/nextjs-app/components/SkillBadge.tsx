'use client'

interface SkillBadgeProps {
  name: string
  variant?: 'default' | 'primary'
}

export default function SkillBadge({ name, variant = 'default' }: SkillBadgeProps) {
  const baseStyles = 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors'
  
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    primary: 'bg-slate-900 text-white border border-slate-900',
  }

  return (
    <span className={`${baseStyles} ${variantStyles[variant]}`}>
      {name}
    </span>
  )
}
