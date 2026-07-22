"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ShieldAlert, Target, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateReturnPercent,
  fetchQuotes,
  formatPrice,
  formatReturnPercent,
  getCachedQuotes,
  normalizeQuoteSymbol,
  type Quote
} from "@/lib/quotes";
import { formatAmount } from "@/lib/money";
import {
  AuthRequiredError,
  getCachedJournalData,
  getOrCreatePreferences,
  getTrade,
  listTradesByStockCode,
  SupabaseConfigError
} from "@/lib/trades-api";
import { getReturnColorClass } from "@/lib/return-colors";
import { getActionTone, getDateLabel, getPriceLabel, getTradeAction, isOpeningAction } from "@/lib/trade-display";
import type { Trade, UserPreferences } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ClosingSnapshot = {
  averageCost: number | null;
  realizedReturnPercent: number | null;
  estimatedPnl: number | null;
};

function getTradeSortValue(trade: Trade) {
  const timestamp = Number(trade.id.split("-").at(-1));
  return `${trade.buyDate}-${Number.isFinite(timestamp) ? timestamp : 0}`;
}

function reduceShares(lots: Array<{ shares: number; price: number }>, sharesToReduce: number) {
  let remaining = sharesToReduce;

  return lots
    .map((lot) => {
      if (remaining <= 0) {
        return lot;
      }

      const reduced = Math.min(lot.shares, remaining);
      remaining -= reduced;

      return {
        ...lot,
        shares: lot.shares - reduced
      };
    })
    .filter((lot) => lot.shares > 0);
}

function getAverageCost(lots: Array<{ shares: number; price: number }>) {
  const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);

  if (totalShares <= 0) {
    return null;
  }

  const totalCost = lots.reduce((sum, lot) => sum + lot.shares * lot.price, 0);
  return totalCost / totalShares;
}

function calculateClosingSnapshot(trade: Trade, relatedTrades: Trade[]): ClosingSnapshot {
  const lots: Array<{ shares: number; price: number }> = [];
  const sortedTrades = [...relatedTrades].sort((a, b) => getTradeSortValue(a).localeCompare(getTradeSortValue(b)));

  for (const item of sortedTrades) {
    if (item.id === trade.id) {
      break;
    }

    const itemAction = getTradeAction(item);
    const shares = item.buyPrice > 0 ? item.tradeAmount / item.buyPrice : 0;

    if (isOpeningAction(itemAction) && shares > 0) {
      lots.push({ shares, price: item.buyPrice });
    } else if (itemAction === "清仓") {
      lots.length = 0;
    } else if (itemAction === "做T卖出" && shares > 0) {
      const nextLots = reduceShares(lots, shares);
      lots.length = 0;
      lots.push(...nextLots);
    }
  }

  const averageCost = getAverageCost(lots);

  if (!averageCost || !trade.buyPrice) {
    return {
      averageCost,
      realizedReturnPercent: null,
      estimatedPnl: null
    };
  }

  const soldShares = trade.buyPrice > 0 ? trade.tradeAmount / trade.buyPrice : 0;

  return {
    averageCost,
    realizedReturnPercent: ((trade.buyPrice - averageCost) / averageCost) * 100,
    estimatedPnl: soldShares > 0 ? (trade.buyPrice - averageCost) * soldShares : null
  };
}

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [relatedTrades, setRelatedTrades] = useState<Trade[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => getCachedJournalData()?.preferences || null);
  const [quotesConfigured, setQuotesConfigured] = useState<boolean | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pageState, setPageState] = useState<"ready" | "anonymous" | "unconfigured">("ready");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadTrade() {
      try {
        const currentTrade = await getTrade(params.id);
        const [sameStockTrades, nextPreferences] = await Promise.all([
          currentTrade ? listTradesByStockCode(currentTrade.stockCode) : Promise.resolve([]),
          getOrCreatePreferences()
        ]);

        setTrade(currentTrade);
        setRelatedTrades(sameStockTrades);
        setPreferences(nextPreferences);
        setPageState("ready");
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          setPageState("unconfigured");
        } else if (error instanceof AuthRequiredError) {
          setPageState("anonymous");
        } else {
          setErrorMessage(error instanceof Error ? error.message : "交易记录读取失败");
        }
      } finally {
        setIsLoaded(true);
      }
    }

    void loadTrade();
  }, [params.id]);

  useEffect(() => {
    if (!trade) {
      setQuote(null);
      setIsQuoteLoading(false);
      return;
    }

    const quoteInput = { symbol: trade.stockCode, market: trade.market };
    const symbol = normalizeQuoteSymbol(trade.stockCode, trade.market);
    const cachedQuote = getCachedQuotes([quoteInput])[symbol] || null;

    if (cachedQuote) {
      setQuote(cachedQuote);
      setQuotesConfigured(true);
    }

    setIsQuoteLoading(true);
    fetchQuotes([quoteInput])
      .then((result) => {
        setQuote(result.quotes[symbol] || cachedQuote);
        setQuotesConfigured(result.configured);
      })
      .catch(() => {
        setQuote(cachedQuote);
        setQuotesConfigured(cachedQuote ? true : false);
      })
      .finally(() => {
        setIsQuoteLoading(false);
      });
  }, [trade]);

  if (!isLoaded) {
    return (
      <AppShell className="pb-8">
        <div className="px-5 py-8 text-sm text-slate-500">正在读取交易记录...</div>
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
              <h1 className="text-xl font-bold text-slate-950">没有找到这笔交易</h1>
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
  const shouldShowFloatingReturn = isOpeningAction(action);
  const shouldShowTradePlan = action === "买入";
  const shouldShowClosingReview = !isOpeningAction(action);
  const returnPercent = shouldShowFloatingReturn ? calculateReturnPercent(trade, quote || undefined) : null;
  const returnLabel = returnPercent === null && isQuoteLoading ? "更新中" : formatReturnPercent(returnPercent);
  const closingSnapshot = shouldShowClosingReview ? calculateClosingSnapshot(trade, relatedTrades) : null;
  const openingTrades = relatedTrades.filter((item) => isOpeningAction(getTradeAction(item)));
  const closingTrades = relatedTrades.filter((item) => !isOpeningAction(getTradeAction(item)));

  return (
    <AppShell className="pb-8">
      <header className="px-5 pb-4 pt-5">
        <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
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
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-2xl font-bold",
                getReturnColorClass(returnPercent, preferences?.return_color_mode || "red_up_green_down")
              )}
            >
              {shouldShowFloatingReturn ? returnLabel : "已记录"}
            </p>
            <p className="text-xs text-slate-400">
              {!shouldShowFloatingReturn
                ? "清仓动作"
                : quote?.currentPrice
                ? `现价 ${formatPrice(quote.currentPrice)}`
                : isQuoteLoading
                  ? "正在取行情"
                : quotesConfigured === false
                  ? "待配置行情源"
                  : "当前收益"}
            </p>
          </div>
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

        {shouldShowTradePlan ? (
          <Card className="border-0">
            <CardHeader>
              <CardTitle>交易计划摘要</CardTitle>
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

        {shouldShowClosingReview ? (
          <Card className="border-0">
            <CardHeader>
              <CardTitle>闭环复盘</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">卖出前成本</p>
                  <p className="mt-1 font-bold text-slate-950">{formatPrice(closingSnapshot?.averageCost)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">实际收益率</p>
                  <p
                    className={cn(
                      "mt-1 font-bold",
                      getReturnColorClass(
                        closingSnapshot?.realizedReturnPercent ?? null,
                        preferences?.return_color_mode || "red_up_green_down"
                      )
                    )}
                  >
                    {formatReturnPercent(closingSnapshot?.realizedReturnPercent ?? null)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">估算盈亏</p>
                  <p
                    className={cn(
                      "mt-1 font-bold",
                      getReturnColorClass(closingSnapshot?.estimatedPnl ?? null, preferences?.return_color_mode || "red_up_green_down")
                    )}
                  >
                    {closingSnapshot?.estimatedPnl === null || closingSnapshot?.estimatedPnl === undefined
                      ? "暂无"
                      : formatAmount(closingSnapshot.estimatedPnl)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm text-slate-500">是否按原计划执行</p>
                <p className="mt-1 font-bold text-slate-950">{trade.planFollowed || "未填写"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">这次卖出复盘</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{trade.exitReview || "未填写"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">下次要改进什么</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{trade.lessonLearned || "未填写"}</p>
              </div>

              <p className="px-1 text-xs leading-5 text-slate-400">
                成本与盈亏为基于同股票历史交易金额和价格的估算，用于复盘参考，不等同于券商交割数据。
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-0">
          <CardHeader>
            <CardTitle>交易记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 pb-1">
              <div className="rounded-2xl bg-blue-50 p-3">
                <p className="text-xs text-slate-500">买入类</p>
                <p className="mt-1 font-bold text-slate-950">{openingTrades.length} 笔</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-3">
                <p className="text-xs text-slate-500">卖出类</p>
                <p className="mt-1 font-bold text-slate-950">{closingTrades.length} 笔</p>
              </div>
            </div>

            {relatedTrades.map((item) => {
              const itemAction = getTradeAction(item);

              return (
                <Link key={item.id} href={`/logs/${item.id}`} className="block rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", getActionTone(itemAction))}>
                          {itemAction}
                        </span>
                        <p className="truncate text-sm font-bold text-slate-950">{item.tradeType}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {item.buyDate || "未填日期"} · {getPriceLabel(itemAction)} {item.buyPrice} · 金额{" "}
                        {formatAmount(item.tradeAmount)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      查看详情
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Button className="w-full" variant="secondary">
          标记为待周报复盘
        </Button>
      </section>
    </AppShell>
  );
}
