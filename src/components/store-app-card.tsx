import { Check, CircleAlert, FileCode2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type StoreAppCardProps = {
  title: string
  iconUrl?: string
  iconColor?: string
  description?: string
  queued: boolean
  installed: boolean
  removalQueued: boolean
  needsRepair: boolean
  busy: boolean
  onToggle: () => void
}

export function StoreAppCard({ title, iconUrl, iconColor, description, queued, installed, removalQueued, needsRepair, busy, onToggle }: StoreAppCardProps) {
  const selected = queued || removalQueued
  const actionLabel = needsRepair
    ? `Repair ${title} before changing it`
    : removalQueued
      ? `Keep ${title} installed`
      : installed
        ? `Remove ${title}`
        : queued
          ? `Do not add ${title}`
          : `Add ${title}`

  return (
    <div className={`surface relative flex h-full items-start gap-4 p-4 pr-14 ${queued ? 'border-primary/60 bg-primary/5' : removalQueued ? 'border-red-400/50 bg-red-400/5' : ''}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10" style={iconColor ? { backgroundColor: iconColor } : undefined}>
        {iconUrl
          ? <img src={iconUrl} alt="" className="h-8 w-8 object-contain" />
          : <FileCode2 className="h-5 w-5 text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="min-w-0 break-words font-mono text-sm uppercase tracking-[0.12em]">{title}</h3>
        {queued && <span className="mt-2 inline-flex font-mono text-[0.65rem] uppercase tracking-[0.12em] text-primary">Add on save</span>}
        {removalQueued && <span className="mt-2 inline-flex font-mono text-[0.65rem] uppercase tracking-[0.12em] text-red-700 dark:text-red-300">Remove on save</span>}
        {description && <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      <Button
        className="absolute right-3 top-3 h-8 w-8 p-0"
        size="sm"
        variant={removalQueued ? 'destructive' : queued ? 'default' : 'outline'}
        onClick={onToggle}
        disabled={busy || needsRepair}
        aria-label={actionLabel}
        title={actionLabel}
      >
        {needsRepair ? <CircleAlert /> : selected ? <Check /> : installed ? <Minus /> : <Plus />}
      </Button>
    </div>
  )
}
