import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:brightness-110 active:brightness-95",
        soft: "bg-accent-soft text-ink hover:brightness-95",
        outline: "border border-line bg-card text-ink hover:bg-paper-2",
        ghost: "text-ink-soft hover:bg-paper-2",
        danger: "bg-danger text-white hover:brightness-110",
      },
      size: {
        md: "h-11 px-5 text-base",
        lg: "h-14 px-7 text-lg",
        sm: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className, variant, size, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
