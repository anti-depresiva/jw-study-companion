import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/** Link im Aussehen eines Buttons. */
export function ButtonLink({ className, variant, size, ...props }: Props) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Externer Link (immer neuer Tab, ohne Referrer/Opener). */
export function ExternalButtonLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"a"> & VariantProps<typeof buttonVariants>) {
  return <a target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
