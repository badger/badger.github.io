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
    <div className="surface flex h-full items-start gap-4 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {iconUrl
          ? <img src={iconUrl} alt="" className="h-8 w-8 object-contain" />
          : <FileCode2 className="h-5 w-5 text-primary" />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="min-w-0 break-words font-mono text-sm uppercase tracking-[0.12em]">{title}</h3>
        {description && <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{description}</p>}
        <div className="mt-3 flex justify-end">
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
      </div>
    </div>
  )
}
