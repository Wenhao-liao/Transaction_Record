"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ShieldAlert, Target, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/money";
import { AuthRequiredError, getTrade, SupabaseConfigError } from "@/lib/trades-api";
import { getActionTone, getDateLabel, getPriceLabel, getTradeAction, isOpeningAction } from "@/lib/trade-display";
import type { Trade } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function TradeLogDetailPage({ params }: { params: { id: string } }) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pageState, setPageState] = useState<"ready" | "anonymous" | "unconfigured">("ready");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTrade() {
      try {
        setTrade(await getTrade(params.id));
        setPageState("ready");
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          setPageState("unconfigured");
        } else if (error instanceof AuthRequiredError) {
          setPageState("anonymous");
        } else {
          setErrorMessage(error instanceof Error ? error.message : "交易日志读取失败");
        }
      } finally {
        setIsLoaded(true);
      }
    }

    void loadTrade();
  }, [params.id]);

  if (!isLoaded) {
    return (
      <AppShell className="pb-8">
        <div className="px-5 py-8 text-sm text-slate-500">正在读取交易日志...</div>
      </AppShell>
    );
  }

  if (pageState === "unconfigured") {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <ConfigNotice />
        </section>
      </AppShell>
    );
  }

  if (pageState === "anonymous") {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <AuthNotice />
        </section>
      </AppShell>
    );
  }

  if (errorMessage) {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <Card className="border-0">
            <CardContent className="p-5 text-sm text-red-500">{errorMessage}</CardContent>
          </Card>
        </section>
      </AppShell>
    );
  }

  if (!trade) {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Card className="border-0">
            <CardContent className="p-6 text-center">
              <h1 className="text-xl font-bold text-slate-950">没有找到这条交易日志</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                这条记录可能不存在，或者你没有访问权限。
              </p>
              <Link href="/trades/new" className="mt-5 block">
                <Button className="w-full">新建交易</Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </AppShell>
    );
  }

  const action = getTradeAction(trade);
  const isBuyAction = isOpeningAction(action);
  const shouldShowTradePlan = action === "买入";
  const logicItems = [
    { label: isBuyAction ? "为什么现在买？" : "为什么现在卖？", value: trade.whyNow || "未填写" },
    { label: "风险因素", value: trade.riskFactors || "未填写" },
    {
      label: isBuyAction ? "什么情况证明我错？" : "清仓后什么情况证明我错？",
      value: trade.invalidation || "未填写"
    }
  ];

  return (
    <AppShell className="pb-8">
      <header className="px-5 pb-4 pt-5">
        <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <p className="text-sm font-semibold text-primary">
          {trade.market} · {trade.stockCode}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{trade.stockName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", getActionTone(action))}>
            {action}
          </span>
          <span>
            {trade.buyDate} · {trade.tradeType}
          </span>
        </div>
      </header>

      <section className="space-y-4 px-5">
        <Card className="border-0">
          <CardContent className="grid grid-cols-2 gap-3 p-4 text-center">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{getPriceLabel(action)}</p>
              <p className="mt-1 font-bold text-slate-950">{trade.buyPrice}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">交易金额</p>
              <p className="mt-1 font-bold text-slate-950">{formatAmount(trade.tradeAmount)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">仓位</p>
              <p className="mt-1 font-bold text-slate-950">{trade.positionRatio || "未计算"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">行业/主题</p>
              <p className="mt-1 font-bold text-slate-950">{trade.sector || "未填写"}</p>
            </div>
          </CardContent>
        </Card>

        {trade.tags.length > 0 ? (
          <Card className="border-0">
            <CardHeader>
              <CardTitle>交易标签</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {trade.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

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

        {shouldShowTradePlan ? (
          <Card className="border-0">
            <CardHeader>
              <CardTitle>交易计划</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4">
                <Target className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm text-slate-500">目标收益</p>
                  <p className="font-bold text-slate-950">{trade.targetReturn || "未填写"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                <TimerReset className="h-5 w-5 text-slate-500" />
                <div className="flex-1">
                  <p className="text-sm text-slate-500">预计持有时间</p>
                  <p className="font-bold text-slate-950">{trade.holdingPeriod || "未填写"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm text-slate-500">止损价格</p>
                  <p className="font-bold text-slate-950">{trade.stopLossPrice || "未填写"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
