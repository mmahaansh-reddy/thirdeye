import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-9", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-16 py-2", className)} {...props} />;
}

/** Native select styled to match shadcn inputs (keeps forms simple & accessible). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-9 bg-background", className)} {...props} />;
}

export { Input, Textarea, NativeSelect };
