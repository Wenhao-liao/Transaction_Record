import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto min-h-screen max-w-md bg-slate-50 pb-28", className)}>
      {children}
    </main>
  );
}
