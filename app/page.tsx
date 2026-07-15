import Link from "next/link";
import { ArrowRight, ClipboardList, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BottomNav, MiniChartIcon } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Trade } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const trades: Trade[] = [];
  const recentActivities: Array<{ title: string; subtitle: string; time: string }> = [];
  const hasTrades = trades.length > 0;
  const totalPosition = trades.reduce((sum, trade) => {
    return sum + Number.parseFloat(trade.positionRatio.replace("%", ""));
  }, 0);
  const bestTrade = trades
    .filter((trade) => trade.currentReturn.startsWith("+"))
    .sort((a, b) => Number.parseFloat(b.currentReturn) - Number.parseFloat(a.currentReturn))[0];

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
              <div className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                {trades.length} 笔持仓
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 p-3">
                <p className="text-xs text-blue-100">最佳表现</p>
                <p className="mt-1 font-semibold">
                  {bestTrade ? `${bestTrade.stockCode} ${bestTrade.currentReturn}` : "暂无记录"}
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3">
                <p className="text-xs text-blue-100">待复盘</p>
                <p className="mt-1 font-semibold">{hasTrades ? "本周待生成" : "暂无交易"}</p>
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

        {hasTrades ? (
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
        ) : (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center px-6 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
                <ClipboardList className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-950">还没有持仓记录</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                首页只展示你的真实交易日志。先记录第一笔买入决策，之后这里会自动汇总持仓、仓位和复盘状态。
              </p>
              <Link href="/trades/new" className="mt-5 w-full">
                <Button className="w-full">记录第一笔交易</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card className="border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-950">AI 周报</p>
                  <p className="text-sm text-slate-500">
                    {hasTrades ? "整理本周买入逻辑与风险暴露" : "记录交易后即可生成复盘"}
                  </p>
                </div>
              </div>
              <Button disabled={!hasTrades} size="sm" variant="secondary">
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
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.title} className="flex gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <ArrowRight className="h-4 w-4 text-slate-500" />
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
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">暂无交易记录</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  你的新增、修改和复盘动作会显示在这里，方便回看决策过程。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <BottomNav current="/" />
    </AppShell>
  );
}
