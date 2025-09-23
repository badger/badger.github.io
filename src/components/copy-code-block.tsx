import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyCodeBlockProps {
  code: string
  language: string
  className?: string
}

/**
 * Copy Code Block Component
 * Displays syntax-highlighted code with a copy button
 */
export function CopyCodeBlock({ code, language, className }: CopyCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className={cn("relative group", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-muted border border-border rounded-t-lg">
        <span className="text-sm text-muted-foreground font-mono">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2 text-xs opacity-70 hover:opacity-100"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      <div className="relative overflow-x-auto">
        <pre className="bg-muted/50 border border-t-0 border-border rounded-b-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground whitespace-pre">
            {code}
          </code>
        </pre>
      </div>
    </div>
  )
}