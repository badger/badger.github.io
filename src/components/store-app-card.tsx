import { Check, CircleAlert, FileCode2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'

type StoreAppCardProps = {
  title: string
  iconUrl?: string
  description?: string
  queued: boolean
  installed: boolean
  needsRepair: boolean
  busy: boolean
  onAdd: () => void
}

export function StoreAppCard({ title, iconUrl, description, queued, installed, needsRepair, busy, onAdd }: StoreAppCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {iconUrl
            ? <img src={iconUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
            : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10"><FileCode2 className="h-5 w-5 text-primary" /></div>}
          <h3 className="min-w-0 break-words font-mono text-sm uppercase tracking-[0.12em]">{title}</h3>
        </div>
        <Button
          size="sm"
          variant={queued || installed ? 'secondary' : 'outline'}
          onClick={onAdd}
          disabled={busy || installed || needsRepair}
          aria-label={`${installed ? 'Installed' : needsRepair ? 'Repair first' : queued ? 'Added' : 'Add'}: ${title}`}
        >
          {installed ? <><Check /> Installed</>
            : needsRepair ? <><CircleAlert /> Repair first</>
              : queued ? <><Check /> Added</>
                : <><ShoppingBag /> Add</>}
        </Button>
      </div>
      <p className={`mt-2 break-words text-xs leading-5 text-muted-foreground ${description ? '' : 'font-mono'}`}>
        {description || 'Description not available'}
      </p>
    </div>
  )
}
