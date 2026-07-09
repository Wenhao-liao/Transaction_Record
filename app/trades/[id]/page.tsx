import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldAlert, Target, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trades } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return trades.map((trade) => ({ id: trade.id }));
}

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  const trade = trades.find((item) => item.id === params.id);

  if (!trade) {
    notFound();
  }

  const logicItems = [
    { label: "为什么现在买？", value: trade.whyNow },
    { label: "看涨因素", value: trade.bullishFactors },
    { label: "风险因素", value: trade.riskFactors },
    { label: "什么情况证明我错？", value: trade.invalidation }
  ];

  return (
    <AppShell className="pb-8">
      <header className="px-5 pb-4 pt-5">
        <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">{trade.market} · {trade.stockCode}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{trade.stockName}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {trade.buyDate} 买入 · {trade.tradeType}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-2xl font-bold",
                trade.currentReturn.startsWith("+") ? "text-emerald-600" : "text-red-500"
              )}
            >
              {trade.currentReturn}
            </p>
            <p className="text-xs text-slate-400">当前收益</p>
          </div>
        </div>
      </header>

      <section className="space-y-4 px-5">
        <Card className="border-0">
          <CardContent className="grid grid-cols-3 gap-3 p-4 text-center">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">买入价</p>
              <p className="mt-1 font-bold text-slate-950">{trade.buyPrice}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">仓位</p>
              <p className="mt-1 font-bold text-slate-950">{trade.positionRatio}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">状态</p>
              <p className="mt-1 font-bold text-slate-950">{trade.status}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader>
            <CardTitle>完整交易逻辑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {logicItems.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader>
            <CardTitle>交易计划</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4">
              <Target className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm text-slate-500">目标收益</p>
                <p className="font-bold text-slate-950">{trade.targetReturn}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
              <TimerReset className="h-5 w-5 text-slate-500" />
              <div className="flex-1">
                <p className="text-sm text-slate-500">预计持有时间</p>
                <p className="font-bold text-slate-950">{trade.holdingPeriod}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <div className="flex-1">
                <p className="text-sm text-slate-500">止损价格</p>
                <p className="font-bold text-slate-950">{trade.stopLossPrice}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" variant="secondary">
          标记为待周报复盘
        </Button>
      </section>
    </AppShell>
  );
}
