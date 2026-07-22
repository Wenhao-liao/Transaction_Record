"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, EyeOff, Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCurrentPositions, getTotalPositionRatio, type CurrentPosition } from "@/lib/positions";
import {
  fetchQuotes,
  getCachedExchangeRates,
  getCachedQuotes,
  type Quote
} from "@/lib/quotes";
import { formatAmount } from "@/lib/money";
import { calculatePortfolioMetrics } from "@/lib/portfolio";
import {
  buildRiskAlerts,
  getRiskAlertTone,
  getRiskAlertTypeLabel,
  setHideRiskAlertsOnHome,
  shouldHideRiskAlertsOnHome,
  type RiskAlert
} from "@/lib/risk-alerts";
import type { ExchangeRates } from "@/lib/currency";
import {
  AuthRequiredError,
  getCachedJournalData,
  loadJournalData,
  SupabaseConfigError
} from "@/lib/trades-api";
import type { Trade, UserPreferences } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function formatPositionRatio(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function getAlertHelper(alert: RiskAlert) {
  if (alert.type === "stop_loss") {
    return "系统根据你填写的止损价和当前行情估算。";
  }

  if (alert.type === "position_size") {
    return "系统根据你设置的本金和交易金额折算仓位。";
  }

  return "系统根据你填写的行业/主题聚合同类持仓。";
}

function RiskAlertCard({ alert }: { alert: RiskAlert }) {
  return (
    <Card className="border-0">
      <CardContent className="p-5">
        <div className="flex gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", getRiskAlertTone(alert.level))}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                {getRiskAlertTypeLabel(alert.type)}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", getRiskAlertTone(alert.level))}>
                {alert.level === "danger" ? "优先处理" : alert.level === "warning" ? "需要关注" : "观察提醒"}
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-950">{alert.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{alert.description}</p>
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              {getAlertHelper(alert)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PositionRiskSummary({ positions }: { positions: CurrentPosition[] }) {
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="border-0">
      <CardHeader className="pb-2">
        <CardTitle>持仓暴露概览</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {positions.slice(0, 5).map((position) => (
          <div key={position.quoteSymbol} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">{position.stockName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {position.market} · {position.stockCode}
                {position.sector ? ` · ${position.sector}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-primary">{formatPositionRatio(position.positionRatio)}</p>
              <p className="mt-1 text-xs text-slate-400">
                {position.stopLossPrice ? `止损 ${position.stopLossPrice}` : "未填止损"}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function RisksPage() {
  const cachedJournalData = getCachedJournalData();
  const [trades, setTrades] = useState<Trade[]>(() => cachedJournalData?.trades || []);
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => cachedJournalData?.preferences || null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(() => getCachedExchangeRates());
  const [pageState, setPageState] = useState<"checking" | "ready" | "anonymous" | "unconfigured">(
    cachedJournalData ? "ready" : "checking"
  );
  const [hideHomeDisplay, setHideHomeDisplay] = useState(false);
  const [isQuotesLoading, setIsQuotesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setHideHomeDisplay(shouldHideRiskAlertsOnHome());

    async function loadData() {
      try {
        const journalData = await loadJournalData();
        setTrades(journalData.trades);
        setPreferences(journalData.preferences);
        setPageState("ready");
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          setPageState("unconfigured");
        } else if (error instanceof AuthRequiredError) {
          setPageState("anonymous");
        } else {
          setErrorMessage(error instanceof Error ? error.message : "风险提醒读取失败");
          setPageState("ready");
        }
      }
    }

    void loadData();
  }, []);

  useEffect(() => {
    if (trades.length === 0) {
      setQuotes({});
      setIsQuotesLoading(false);
      return;
    }

    const symbols = trades.map((trade) => ({ symbol: trade.stockCode, market: trade.market }));
    const cachedQuotes = getCachedQuotes(symbols);

    if (Object.keys(cachedQuotes).length > 0) {
      setQuotes(cachedQuotes);
    }

    setIsQuotesLoading(true);
    fetchQuotes(symbols)
      .then((result) => {
        setQuotes((currentQuotes) => ({ ...currentQuotes, ...result.quotes }));
        setExchangeRates(result.exchangeRates);
      })
      .catch(() => setQuotes((currentQuotes) => currentQuotes))
      .finally(() => setIsQuotesLoading(false));
  }, [trades]);

  const currentPositions = useMemo(
    () => buildCurrentPositions(trades, preferences?.account_total_amount, exchangeRates),
    [exchangeRates, preferences?.account_total_amount, trades]
  );
  const riskAlerts = useMemo(() => buildRiskAlerts(currentPositions, quotes), [currentPositions, quotes]);
  const portfolioMetrics = useMemo(
    () => calculatePortfolioMetrics(trades, preferences?.account_total_amount, quotes, exchangeRates),
    [exchangeRates, preferences?.account_total_amount, quotes, trades]
  );
  const totalPositionRatio = useMemo(() => getTotalPositionRatio(currentPositions), [currentPositions]);

  function toggleHomeDisplay() {
    const nextValue = !hideHomeDisplay;
    setHideHomeDisplay(nextValue);
    setHideRiskAlertsOnHome(nextValue);
  }

  if (pageState === "checking") {
    return (
      <AppShell className="pb-8">
        <div className="px-5 py-8 text-sm text-slate-500">正在读取持仓风险...</div>
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

  return (
    <AppShell className="pb-8">
      <header className="px-5 pb-4 pt-5">
        <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-600">持仓陪跑提醒</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">持仓风险</h1>
          </div>
        </div>
      </header>

      <section className="space-y-4 px-5">
        {errorMessage ? (
          <Card className="border-0">
            <CardContent className="p-5 text-sm text-red-500">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden border-0 bg-slate-950 text-white">
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-2xl font-bold">{riskAlerts.length}</p>
                <p className="mt-1 text-xs text-slate-300">提醒数</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-2xl font-bold">{formatPositionRatio(totalPositionRatio)}</p>
                <p className="mt-1 text-xs text-slate-300">总仓位</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-2xl font-bold">{currentPositions.length}</p>
                <p className="mt-1 text-xs text-slate-300">持仓数</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {portfolioMetrics
                ? `当前总资金约 ${formatAmount(portfolioMetrics.totalAssets)}，提醒仅用于复盘，不等于系统认为必须卖出。`
                : "提醒仅用于复盘，不等于系统认为必须卖出。"}
            </p>
          </CardContent>
        </Card>

        {isQuotesLoading ? <p className="px-1 text-xs text-slate-400">正在更新实时行情，止损提醒会随后刷新。</p> : null}

        {riskAlerts.length > 0 ? (
          <div className="space-y-3">
            {riskAlerts.map((alert) => (
              <RiskAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <Card className="border-0">
            <CardContent className="p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-950">暂无明显持仓风险</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                系统会根据止损价、仓位比例、行业集中度持续提醒。没有提醒也不代表没有风险，仍建议定期复盘。
              </p>
            </CardContent>
          </Card>
        )}

        <PositionRiskSummary positions={currentPositions} />

        <Button className="w-full" onClick={toggleHomeDisplay} variant="secondary">
          {hideHomeDisplay ? (
            <>
              <Eye className="mr-2 h-4 w-4" />
              恢复首页展示
            </>
          ) : (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              取消首页展示
            </>
          )}
        </Button>
      </section>
    </AppShell>
  );
}
