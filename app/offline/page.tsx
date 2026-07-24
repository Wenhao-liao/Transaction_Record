import Link from "next/link";
import { WifiOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <AppShell className="flex items-center px-5">
      <Card className="w-full border-0">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-primary">
            <WifiOff className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">当前网络不可用</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            你可以查看已经缓存过的页面。新增交易、同步数据和生成 AI 周报需要联网后再继续。
          </p>
          <Link className="mt-6 w-full" href="/">
            <Button className="w-full">回到首页</Button>
          </Link>
        </CardContent>
      </Card>
    </AppShell>
  );
}
