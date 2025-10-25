import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-mono tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "border border-border/40 bg-transparent hover:border-primary/50 hover:bg-primary/5 text-foreground data-[state=active]:border-primary shadow-sm hover:shadow-md active:shadow-inner",
        destructive:
          "border-2 border-red-600/40 text-red-600 dark:text-red-400 bg-background hover:bg-red-600/5 hover:border-red-600/60 shadow-sm hover:shadow-md",
        outline:
          "border border-border/50 bg-transparent hover:bg-muted/10 hover:text-foreground hover:border-primary/60 shadow-sm active:shadow-inner",
        secondary:
          "border border-secondary/40 bg-secondary/10 text-secondary-foreground hover:bg-secondary/20 hover:border-secondary/60 active:shadow-inner",
  ghost: "hover:bg-muted/10 hover:text-foreground",
  link: "text-primary underline-offset-4 hover:underline font-mono",
      },
      size: {
  default: "h-10 px-5",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-12 px-8 text-base",
  icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
