import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // שימוש ב-gap-2 מבטיח ריווח נכון בין טקסט לאייקון ב-RTL וב-LTR
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-[#42C0B9] text-[#0F172A] hover:bg-[#3AA8A2] dark:shadow-[0_0_15px_rgba(66,192,185,0.3)] dark:hover:shadow-[0_0_25px_rgba(66,192,185,0.5)] font-bold",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground border-slate-200 dark:border-white/10",
        secondary:
          "bg-slate-100 text-slate-900 dark:bg-[#1E293B] dark:text-white hover:bg-slate-200 dark:hover:bg-[#2A3855]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Gold Variant - Premium Look
        gold: "bg-[#E5A840] text-[#0F172A] hover:bg-[#D49630] dark:shadow-[0_0_15px_rgba(229,168,64,0.3)] font-bold",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 rounded-full px-4",
        lg: "h-12 rounded-full px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
