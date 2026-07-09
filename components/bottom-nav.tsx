import Link from "next/link";
import { BarChart3, Home, PlusCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "首页", icon: Home, active: true },
  { href: "/trades/new", label: "新建交易", icon: PlusCircle, active: false },
  { href: "/profile", label: "我的", icon: UserRound, active: false }
];

export function BottomNav({ current = "/" }: { current?: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-200/80 bg-white/95 px-4 pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.06)] backdrop-blur safe-bottom">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = current === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-medium text-slate-500",
                active && "bg-blue-50 text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MiniChartIcon() {
  return <BarChart3 className="h-5 w-5" />;
}
