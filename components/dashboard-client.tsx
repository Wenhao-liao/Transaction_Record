"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  FileInput,
  Repeat,
  Sparkles,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { BottomNav, MiniChartIcon } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/money";
import {
  fetchQuotes,
  formatPrice,
  formatReturnPercent,
  getCachedExchangeRates,
  getCachedQuotes,
  type Quote
} from "@/lib/quotes";
import type { ExchangeRates } from "@/lib/currency";
import { buildCurrentPositions, getTotalPositionRatio, type CurrentPosition } from "@/lib/positions";
import { calculatePortfolioMetrics } from "@/lib/portfolio";
import { getCurrentWeekRange } from "@/lib/date-range";
import { getReturnColorClass } from "@/lib/return-colors";
import {
  buildRiskAlerts,
  getRiskAlertTone,
  shouldHideRiskAlertsOnHome,
  type RiskAlert
} from "@/lib/risk-alerts";
import {
  AuthRequiredError,
  clearJournalDataCache,
  deleteTrades,
  getCachedJournalData,
  loadJournalData,
  SupabaseConfigError
} from "@/lib/trades-api";
import { getActionTone, getTradeAction, isReviewableTrade } from "@/lib/trade-display";
import { isSupabaseConfigured, supabase, type Trade, type UserPreferences } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function getActivityIcon(action: string) {
  if (action === "清仓") {
    return {
      icon: ArrowUpRight,
      className: "bg-red-50 text-red-500"
    };
  }

  if (action === "做T买入") {
    return {
      icon: Repeat,
      className: "bg-violet-50 text-violet-500"
    };
  }

  if (action === "做T卖出") {
    return {
      icon: Repeat,
      className: "bg-orange-50 text-orange-500"
    };
  }

  return {
    icon: ArrowDownLeft,
    className: "bg-blue-50 text-primary"
  };
}

function formatPositionRatio(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function calculatePositionReturnPercent(position: CurrentPosition, quote?: Quote) {
  if (!quote?.currentPrice || !position.averageCost) {
    return null;
  }

  return ((quote.currentPrice - position.averageCost) / position.averageCost) * 100;
}

const positionTabs = ["全部", "A股", "港股", "美股"] as const;
type PositionTab = (typeof positionTabs)[number];
const positionSorts = [
  { label: "仓位大小", value: "position" },
  { label: "收益高低", value: "return" }
] as const;
type PositionSort = (typeof positionSorts)[number]["value"];
type SortDirection = "desc" | "asc";

const weeklyReportLoadingMessages = [
  "正在翻阅本周交易记录",
  "正在找出重复的决策模式",
  "正在整理风险暴露",
  "正在把复盘写成可执行建议"
];

function getPositionRiskAlert(position: CurrentPosition, alerts: RiskAlert[]) {
  return alerts.find((alert) => alert.symbol === position.quoteSymbol);
}

export function DashboardClient() {
  const router = useRouter();
  const cachedJournalData = getCachedJournalData();
  const [trades, setTrades] = useState<Trade[]>(() => cachedJournalData?.trades || []);
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => cachedJournalData?.preferences || null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(() => getCachedExchangeRates());
  const [quotesConfigured, setQuotesConfigured] = useState<boolean | null>(null);
  const [isQuotesLoading, setIsQuotesLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "anonymous" | "unconfigured">(
    !isSupabaseConfigured ? "unconfigured" : cachedJournalData ? "authenticated" : "checking"
  );
  const [swipedPosition, setSwipedPosition] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [deletingPosition, setDeletingPosition] = useState("");
  const [activePositionTab, setActivePositionTab] = useState<PositionTab>("全部");
  const [positionSort, setPositionSort] = useState<PositionSort>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [errorMessage, setErrorMessage] = useState("");
  const [reportLoadingStep, setReportLoadingStep] = useState(0);
  const [hideRiskAlertsOnHome, setHideRiskAlertsOnHome] = useState(false);
  const reviewableTrades = useMemo(() => trades.filter(isReviewableTrade), [trades]);
  const hasTrades = reviewableTrades.length > 0;
  const currentPositions = useMemo(
    () => buildCurrentPositions(trades, preferences?.account_total_amount, exchangeRates),
    [exchangeRates, preferences?.account_total_amount, trades]
  );
  const hasCurrentPositions = currentPositions.length > 0;
  const filteredPositions = useMemo(() => {
    if (activePositionTab === "全部") {
      return currentPositions;
    }

    return currentPositions.filter((position) => position.market === activePositionTab);
  }, [activePositionTab, currentPositions]);
  const hasFilteredPositions = filteredPositions.length > 0;
  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      const direction = sortDirection === "desc" ? 1 : -1;

      if (positionSort === "return") {
        const aReturn = calculatePositionReturnPercent(a, quotes[a.quoteSymbol]);
        const bReturn = calculatePositionReturnPercent(b, quotes[b.quoteSymbol]);

        if (aReturn === null && bReturn === null) {
          return (b.positionRatio - a.positionRatio) * direction;
        }

        if (aReturn === null) {
          return 1;
        }

        if (bReturn === null) {
          return -1;
        }

        return (bReturn - aReturn) * direction;
      }

      return (b.positionRatio - a.positionRatio) * direction;
    });
  }, [filteredPositions, positionSort, quotes, sortDirection]);
  const positionTabCounts = useMemo(() => {
    return positionTabs.reduce<Record<PositionTab, number>>((acc, tab) => {
      acc[tab] =
        tab === "全部" ? currentPositions.length : currentPositions.filter((position) => position.market === tab).length;
      return acc;
    }, {} as Record<PositionTab, number>);
  }, [currentPositions]);

  useEffect(() => {
    function syncRiskAlertPreference() {
      setHideRiskAlertsOnHome(shouldHideRiskAlertsOnHome());
    }

    syncRiskAlertPreference();
    window.addEventListener("focus", syncRiskAlertPreference);
    window.addEventListener("storage", syncRiskAlertPreference);

    return () => {
      window.removeEventListener("focus", syncRiskAlertPreference);
      window.removeEventListener("storage", syncRiskAlertPreference);
    };
  }, []);

  useEffect(() => {
    async function loadTrades(options?: { force?: boolean }) {
      try {
        const result = await loadJournalData({ force: options?.force });
        setTrades(result.trades);
        setPreferences(result.preferences);
        setAuthState("authenticated");
        setErrorMessage("");
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          setAuthState("unconfigured");
          return;
        }

        if (error instanceof AuthRequiredError) {
          setAuthState("anonymous");
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "交易记录读取失败");
      }
    }

    loadTrades();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearJournalDataCache();
        setTrades([]);
        setPreferences(null);
        setAuthState("anonymous");
        return;
      }

      loadTrades({ force: event === "SIGNED_IN" });
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasTrades) {
      setQuotes({});
      setQuotesConfigured(null);
      setIsQuotesLoading(false);
      return;
    }

    const symbols = trades.map((trade) => ({ symbol: trade.stockCode, market: trade.market }));
    const cachedQuotes = getCachedQuotes(symbols);

    if (Object.keys(cachedQuotes).length > 0) {
      setQuotes(cachedQuotes);
      setQuotesConfigured(true);
    }

    setIsQuotesLoading(true);
    fetchQuotes(symbols)
      .then((result) => {
        setQuotes((currentQuotes) => ({
          ...currentQuotes,
          ...result.quotes
        }));
        setExchangeRates(result.exchangeRates);
        setQuotesConfigured(result.configured);
      })
      .catch(() => {
        setQuotes((currentQuotes) => currentQuotes);
        setQuotesConfigured(Object.keys(cachedQuotes).length > 0 ? true : false);
      })
      .finally(() => {
        setIsQuotesLoading(false);
      });
  }, [hasTrades, trades]);

  useEffect(() => {
    if (!isGeneratingReport) {
      setReportLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setReportLoadingStep((currentStep) => (currentStep + 1) % weeklyReportLoadingMessages.length);
    }, 1800);

    return () => {
      window.clearInterval(timer);
    };
  }, [isGeneratingReport]);

  const totalPosition = useMemo(() => {
    return getTotalPositionRatio(currentPositions);
  }, [currentPositions]);
  const riskAlerts = useMemo(() => buildRiskAlerts(currentPositions, quotes), [currentPositions, quotes]);
  const portfolioMetrics = useMemo(
    () => calculatePortfolioMetrics(trades, preferences?.account_total_amount, quotes, exchangeRates),
    [exchangeRates, preferences?.account_total_amount, quotes, trades]
  );

  const positionRiskLabel =
    totalPosition > 100 ? "仓位超过 100%，请检查记录或确认杠杆" : totalPosition >= 80 ? "仓位偏高，注意风险" : "仓位健康";

  const bestPosition = useMemo(() => {
    return currentPositions
      .map((position) => ({
        position,
        returnPercent: calculatePositionReturnPercent(position, quotes[position.quoteSymbol])
      }))
      .filter((item) => item.returnPercent !== null)
      .sort((a, b) => (b.returnPercent || 0) - (a.returnPercent || 0))[0];
  }, [currentPositions, quotes]);

  const weeklyReviewCount = useMemo(() => {
    const { weekStart, weekEnd } = getCurrentWeekRange();

    return reviewableTrades.filter((trade) => trade.buyDate >= weekStart && trade.buyDate <= weekEnd).length;
  }, [reviewableTrades]);

  const recentActivities = reviewableTrades.slice(0, 3).map((trade) => ({
    id: trade.id,
    title: getTradeAction(trade),
    subtitle: `${trade.stockName} ${trade.stockCode} · ${trade.tradeType}${
      trade.tags.length > 0 ? ` · ${trade.tags.slice(0, 2).join("、")}` : ""
    }`,
    time: trade.buyDate || "刚刚"
  }));

  async function handleDeletePosition(position: CurrentPosition) {
    const confirmed = window.confirm(`确认删除 ${position.stockName} 的当前持仓和相关交易记录吗？`);

    if (!confirmed) {
      return;
    }

    setDeletingPosition(position.quoteSymbol);
    setErrorMessage("");

    try {
      await deleteTrades(position.tradeIds);
      setTrades((currentTrades) => currentTrades.filter((trade) => !position.tradeIds.includes(trade.id)));
      setSwipedPosition("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败，请稍后重试");
    } finally {
      setDeletingPosition("");
    }
  }

  async function handleGenerateWeeklyReport() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      router.push("/login");
      return;
    }

    setIsGeneratingReport(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/weekly-report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const result = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !result.id) {
        throw new Error(result.error || "AI 周报生成失败");
      }

      router.push(`/reports/${result.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI 周报生成失败");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  return (
    <AppShell>
      {isGeneratingReport ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <Card className="w-full max-w-md overflow-hidden border-0 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin" />
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-primary shadow-inner">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-950">AI 正在生成周报</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {weeklyReportLoadingMessages[reportLoadingStep]}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-blue-50">
                <div className="h-full w-1/2 animate-[weekly-report-progress_1.8s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>

              <p className="mt-4 text-center text-xs text-slate-400">通常需要十几秒，请保持当前页面打开</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

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

        <Card className="mt-5 overflow-hidden border-0 bg-primary text-white shadow-[0_18px_36px_rgba(37,99,235,0.22)]">
          <CardContent className="relative p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100">{portfolioMetrics ? "当前总资金" : "当前总仓位"}</p>
                <p className="mt-2 text-[2.625rem] font-bold leading-tight tracking-tight">
                  {portfolioMetrics ? formatAmount(portfolioMetrics.totalAssets) : formatPositionRatio(totalPosition)}
                </p>
              </div>
              <div className="rounded-full bg-white/18 px-3 py-1.5 text-sm font-bold shadow-sm">
                {currentPositions.length} 只持仓
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              {portfolioMetrics
                ? portfolioMetrics.hasEstimatedMarketValue
                  ? "部分持仓暂无实时行情，已按成本估算"
                  : "已按实时行情和汇率估算总资金"
                : positionRiskLabel}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-white/14 px-3 py-3 shadow-sm backdrop-blur">
                <p className="text-xs font-medium text-blue-100">{portfolioMetrics ? "总盈利" : "最佳表现"}</p>
                {portfolioMetrics ? (
                  <p
                    className={cn(
                      "mt-1.5 text-xl font-bold tracking-tight",
                      getReturnColorClass(portfolioMetrics.totalProfit, preferences?.return_color_mode)
                    )}
                  >
                    {formatAmount(portfolioMetrics.totalProfit)} · {formatReturnPercent(portfolioMetrics.totalProfitPercent)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xl font-bold tracking-tight">
                    {bestPosition
                      ? `${bestPosition.position.stockName} ${formatReturnPercent(bestPosition.returnPercent)}`
                      : quotesConfigured === false
                        ? "待配置行情源"
                        : "暂无记录"}
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-white/14 px-3 py-3 shadow-sm backdrop-blur">
                <p className="text-xs font-medium text-blue-100">{portfolioMetrics ? "持仓市值" : "本周待复盘"}</p>
                <p className="mt-1.5 text-xl font-bold tracking-tight">
                  {portfolioMetrics
                    ? formatAmount(portfolioMetrics.marketValue)
                    : weeklyReviewCount > 0
                      ? `${weeklyReviewCount} 笔记录`
                      : "暂无交易"}
                </p>
              </div>
            </div>
            {portfolioMetrics ? (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-white/14 px-3 py-3 shadow-sm backdrop-blur">
                  <p className="text-xs font-medium text-blue-100">可用现金</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight">{formatAmount(portfolioMetrics.cashBalance)}</p>
                </div>
                <div className="rounded-2xl bg-white/14 px-3 py-3 shadow-sm backdrop-blur">
                  <p className="text-xs font-medium text-blue-100">当前总仓位</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight">{formatPositionRatio(totalPosition)}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4 px-5">
        {authState === "unconfigured" ? <ConfigNotice /> : null}
        {authState === "anonymous" ? <AuthNotice /> : null}
        {errorMessage ? (
          <Card className="border-0">
            <CardContent className="p-4 text-sm text-red-500">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {!hideRiskAlertsOnHome && riskAlerts.length > 0 ? (
          <Link href="/risks" className="block">
            <Card className="border-0 transition active:scale-[0.99]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>持仓风险提醒</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-500">
                      {riskAlerts.length} 条
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskAlerts.slice(0, 2).map((alert) => (
                  <div key={alert.id} className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        getRiskAlertTone(alert.level)
                      )}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-950">{alert.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{alert.description}</p>
                    </div>
                  </div>
                ))}
                <p className="px-1 text-xs text-slate-400">点击查看完整提醒，或在详情页取消首页展示。</p>
              </CardContent>
            </Card>
          </Link>
        ) : !hideRiskAlertsOnHome && hasCurrentPositions ? (
          <Card className="border-0 bg-blue-50">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-950">暂无明显持仓风险</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">系统会根据止损价、仓位比例、行业集中度持续提醒。</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950">当前持仓</h2>
          <div className="flex items-center gap-3">
            {hasCurrentPositions ? (
              <Link href="/risks" className="text-sm font-semibold text-slate-500">
                风险
              </Link>
            ) : null}
            <Link href="/trades/new" className="text-sm font-semibold text-primary">
              新建
            </Link>
          </div>
        </div>

        <Link href="/positions/import" className="block">
          <Card className="border-0 bg-blue-50">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-primary">
                <FileInput className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-950">导入初始持仓</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">已有股票仓位？导入后只计入持仓，不进入交易复盘。</p>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-300" />
            </CardContent>
          </Card>
        </Link>

        {hasCurrentPositions ? (
          <div className="grid grid-cols-4 rounded-2xl bg-slate-100 p-1">
            {positionTabs.map((tab) => {
              const isActive = activePositionTab === tab;

              return (
                <button
                  key={tab}
                  className={cn(
                    "rounded-xl px-2 py-2 text-xs font-semibold transition",
                    isActive ? "bg-white text-primary shadow-sm" : "text-slate-500"
                  )}
                  onClick={() => {
                    setActivePositionTab(tab);
                    setSwipedPosition("");
                  }}
                  type="button"
                >
                  {tab}
                  <span className={cn("ml-1", isActive ? "text-blue-400" : "text-slate-400")}>
                    {positionTabCounts[tab]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {hasCurrentPositions ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              {activePositionTab} · {filteredPositions.length} 只
            </p>
            <div className="flex gap-2">
              <div className="flex rounded-full bg-white p-1 shadow-sm">
                {positionSorts.map((sort) => {
                  const isActive = positionSort === sort.value;

                  return (
                    <button
                      key={sort.value}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                        isActive ? "bg-blue-50 text-primary" : "text-slate-500"
                      )}
                      onClick={() => {
                        setPositionSort(sort.value);
                        setSwipedPosition("");
                      }}
                      type="button"
                    >
                      {sort.label}
                    </button>
                  );
                })}
              </div>
              <button
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
                onClick={() => {
                  setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                  setSwipedPosition("");
                }}
                type="button"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                {sortDirection === "desc" ? "高到低" : "低到高"}
              </button>
            </div>
          </div>
        ) : null}

        {hasCurrentPositions ? (
          hasFilteredPositions ? (
            <div className="space-y-3">
              {sortedPositions.map((position) => {
                const isSwiped = swipedPosition === position.quoteSymbol;
                const positionRiskAlert = getPositionRiskAlert(position, riskAlerts);

                return (
                  <div key={position.quoteSymbol} className="relative overflow-hidden rounded-2xl">
                    <button
                      className={cn(
                        "absolute inset-y-0 right-0 flex w-20 flex-col items-center justify-center gap-1 bg-red-500 text-xs font-semibold text-white transition-opacity duration-200",
                        isSwiped ? "opacity-100" : "pointer-events-none opacity-0"
                      )}
                      disabled={deletingPosition === position.quoteSymbol}
                      onClick={() => void handleDeletePosition(position)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingPosition === position.quoteSymbol ? "删除中" : "删除"}
                    </button>
                    <Link
                      className={cn(
                        "relative block transition-transform duration-200",
                        isSwiped ? "-translate-x-20" : "translate-x-0"
                      )}
                      href={`/trades/${position.latestTrade.id}`}
                      onClick={(event) => {
                        if (isSwiped) {
                          event.preventDefault();
                          setSwipedPosition("");
                        }
                      }}
                      onTouchEnd={(event) => {
                        if (touchStartX === null) {
                          return;
                        }

                        const deltaX = event.changedTouches[0].clientX - touchStartX;

                        if (deltaX < -40) {
                          setSwipedPosition(position.quoteSymbol);
                        } else if (deltaX > 40) {
                          setSwipedPosition("");
                        }

                        setTouchStartX(null);
                      }}
                      onTouchStart={(event) => {
                        setTouchStartX(event.touches[0].clientX);
                      }}
                    >
                    <Card className="border-0">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-bold text-primary">
                          {position.stockCode.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-bold text-slate-950">{position.stockName}</p>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs", getActionTone(position.latestAction))}>
                              {position.latestAction}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {position.market} · {position.stockCode} · 仓位 {formatPositionRatio(position.positionRatio)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {position.tradeCount} 笔记录
                            {position.tTradeCount > 0 ? ` · 做T ${position.tTradeCount} 次` : ""}
                          </p>
                          {!hideRiskAlertsOnHome && positionRiskAlert ? (
                            <div
                              className={cn(
                                "mt-2 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                                getRiskAlertTone(positionRiskAlert.level)
                              )}
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span className="truncate">{positionRiskAlert.title}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          {(() => {
                            const quote = quotes[position.quoteSymbol];
                            const returnPercent = calculatePositionReturnPercent(position, quote);
                            const returnLabel =
                              returnPercent === null && isQuotesLoading ? "更新中" : formatReturnPercent(returnPercent);

                            return (
                              <>
                                <p
                                  className={cn(
                                    "font-bold",
                                    getReturnColorClass(returnPercent, preferences?.return_color_mode || "red_up_green_down")
                                  )}
                                >
                                  {returnLabel}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {quote?.currentPrice
                                    ? `现价 ${formatPrice(quote.currentPrice)}`
                                    : isQuotesLoading
                                      ? "正在取行情"
                                      : "收益"}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })}
            </div>
          ) : (
            <Card className="border-0">
              <CardContent className="flex flex-col items-center px-6 py-7 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-blue-50 text-primary">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-bold text-slate-950">{activePositionTab}暂无持仓</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">切换到其他市场，或者新建一笔该市场的交易记录。</p>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center px-6 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
                <ClipboardList className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-950">还没有持仓记录</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                当前持仓会按股票代码聚合展示。买入和做T买入增加仓位，做T卖出减少仓位，清仓后不再显示。
              </p>
              <Link href="/trades/new" className="mt-5 w-full">
                <Button className="w-full">记录第一笔交易</Button>
              </Link>
              <Link href="/positions/import" className="mt-3 w-full">
                <Button className="w-full" variant="secondary">
                  导入已有持仓
                </Button>
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
                    {hasTrades
                      ? quotesConfigured === false
                        ? "配置行情源后可同步收益表现"
                        : "整理本周买入逻辑与风险暴露"
                      : "记录交易后即可生成复盘"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href="/reports">
                  <Button size="sm" variant="secondary">
                    历史
                  </Button>
                </Link>
                <Button
                  disabled={!hasTrades || isGeneratingReport}
                  onClick={() => void handleGenerateWeeklyReport()}
                  size="sm"
                  variant="secondary"
                  className="min-w-16"
                >
                  {isGeneratingReport ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                      生成中
                    </span>
                  ) : (
                    "生成"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>最近交易记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => {
                const activityIcon = getActivityIcon(activity.title);
                const ActivityIcon = activityIcon.icon;

                return (
                  <Link key={activity.id} href={`/logs/${activity.id}`} className="-m-2 flex gap-3 rounded-2xl p-2">
                    <div
                      className={cn(
                        "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        activityIcon.className
                      )}
                    >
                      <ActivityIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-950">{activity.title}</p>
                      <p className="truncate text-sm text-slate-500">{activity.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      {activity.time}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                );
              })
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
