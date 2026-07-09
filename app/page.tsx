import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BottomNav, MiniChartIcon } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recentActivities, trades } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const totalPosition = trades.reduce((sum, trade) => {
    return sum + Number.parseFloat(trade.positionRatio.replace("%", ""));
  }, 0);

  return (
    <AppShell>
      <section className="px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">今天的投资日志</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">交易仪表盘</h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <MiniChartIcon />
          </div>
        </div>

        <Card className="mt-5 overflow-hidden border-0 bg-primary text-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-100">当前总仓位</p>
                <p className="mt-2 text-4xl font-bold">{totalPosition}%</p>
              </div>
              <div className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">3 笔持仓</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 p-3">
                <p className="text-xs text-blue-100">最佳表现</p>
                <p className="mt-1 font-semibold">NVDA +6.8%</p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3">
                <p className="text-xs text-blue-100">待复盘</p>
                <p className="mt-1 font-semibold">本周 2 笔</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950">当前持仓</h2>
          <Link href="/trades/new" className="text-sm font-semibold text-primary">
            新建
          </Link>
        </div>

        <div className="space-y-3">
          {trades.map((trade) => (
            <Link key={trade.id} href={`/trades/${trade.id}`}>
              <Card className="border-0">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-bold text-primary">
                    {trade.stockCode.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-slate-950">{trade.stockName}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {trade.tradeType}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {trade.market} · {trade.stockCode} · 仓位 {trade.positionRatio}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "font-bold",
                        trade.currentReturn.startsWith("+") ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      {trade.currentReturn}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">收益</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-950">AI 周报</p>
                  <p className="text-sm text-slate-500">整理本周买入逻辑与风险暴露</p>
                </div>
              </div>
              <Button size="sm" variant="secondary">
                生成
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>最近交易记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.title} className="flex gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{activity.title}</p>
                  <p className="truncate text-sm text-slate-500">{activity.subtitle}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  {activity.time}
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <BottomNav current="/" />
    </AppShell>
  );
}
