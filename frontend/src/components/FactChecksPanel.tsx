import type { ClaimCheck } from "../types";
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'


function badge(status: ClaimCheck['status']) {
    if (status === 'supported') return { v: 'success' as const, Icon: CheckCircle2 }
    if ( status === 'unsupported') return { v: 'danger' as const, Icon: XCircle }
    return { v: 'warning' as const, Icon: AlertTriangle }
}

export function FactChecksPanel({ checks }: { checks: ClaimCheck[] }) {
    return (
        <div className="space-y-3">
          {checks.map((c, idx) => {
            const { v, Icon } = badge(c.status)
            return (
              <Card key={idx}>
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={v}>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3.5 w-3.5" />
                        {c.status}
                      </span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Evidence: {c.evidence_source_ids?.join(', ') || '—'}
                    </span>
                  </div>
                  <div className="text-sm">{c.claim}</div>
                  {c.notes ? <div className="text-xs text-muted-foreground">{c.notes}</div> : null}
                </CardContent>
              </Card>
            )
          })}
          {checks.length === 0 ? <div className="text-sm text-muted-foreground">No fact checks.</div> : null}
        </div>
      )
}