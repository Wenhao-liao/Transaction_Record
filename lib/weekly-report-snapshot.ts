import { convertTradeAmountToCny, DEFAULT_EXCHANGE_RATES, type ExchangeRates } from "@/lib/currency";
import { calculatePortfolioMetrics } from "@/lib/portfolio";
import type { CurrentPosition } from "@/lib/positions";
import type { Trade, TradeAction, UserPreferences } from "@/lib/supabase";
import { getTradeAction, isClosingAction, isOpeningAction } from "@/lib/trade-display";

export type WeeklyReportSnapshot = {
  version: 1;
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  accountTotalAmount: number | null;
  totalTradeCount: number;
  weeklyTradeCount: number;
  currentPositionCount: number;
  totalPositionRatio: number;
  maxPositionRatio: number;
  estimatedCashBalance: number | null;
  estimatedMarketValueAtCost: number | null;
  estimatedTotalAssetsAtCost: number | null;
  estimatedRealizedProfit: number | null;
  estimatedRealizedProfitPercent: number | null;
  actionCounts: Record<string, number>;
  weeklyActionCounts: Record<string, number>;
  weeklyBuyAmountCny: number;
  weeklySellAmountCny: number;
  tagCounts: Record<string, number>;
  weeklyTagCounts: Record<string, number>;
  planFollowedCount: number;
  planNotFollowedCount: number;
  exitReviewCount: number;
  lessonCount: number;
  topPositions: Array<{
    stockName: string;
    stockCode: string;
    market: string;
    positionRatio: number;
    averageCost: number | null;
  }>;
};

function countByAction(trades: Trade[]) {
  return trades.reduce<Record<string, number>>((acc, trade) => {
    const action = getTradeAction(trade);
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});
}

function countByTag(trades: Trade[]) {
  return trades.reduce<Record<string, number>>((acc, trade) => {
    trade.tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });

    return acc;
  }, {});
}

function isPositivePlanFollowed(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && !/否|没有|未|不符合|偏离|违背/.test(normalized);
}

function isNegativePlanFollowed(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && /否|没有|未|不符合|偏离|违背/.test(normalized);
}

function sumTradeAmountByAction(trades: Trade[], predicate: (action: TradeAction) => boolean, rates: ExchangeRates) {
  return trades.reduce((sum, trade) => {
    const action = getTradeAction(trade);
    return predicate(action) ? sum + convertTradeAmountToCny(trade.tradeAmount, trade.market, rates) : sum;
  }, 0);
}

function calculateEstimatedPortfolioAtCost(trades: Trade[], principal: number | null | undefined, rates: ExchangeRates) {
  const metrics = calculatePortfolioMetrics(trades, principal, {}, rates);

  if (!metrics) {
    return {
      estimatedCashBalance: null,
      estimatedMarketValueAtCost: null,
      estimatedTotalAssetsAtCost: null,
      estimatedRealizedProfit: null,
      estimatedRealizedProfitPercent: null
    };
  }

  return {
    estimatedCashBalance: metrics.cashBalance,
    estimatedMarketValueAtCost: metrics.marketValue,
    estimatedTotalAssetsAtCost: metrics.totalAssets,
    estimatedRealizedProfit: metrics.totalProfit,
    estimatedRealizedProfitPercent: metrics.totalProfitPercent
  };
}

export function buildWeeklyReportSnapshot({
  trades,
  weeklyTrades,
  positions,
  preferences,
  weekStart,
  weekEnd,
  exchangeRates = DEFAULT_EXCHANGE_RATES
}: {
  trades: Trade[];
  weeklyTrades: Trade[];
  positions: CurrentPosition[];
  preferences: UserPreferences | null;
  weekStart: string;
  weekEnd: string;
  exchangeRates?: ExchangeRates;
}) {
  const totalPositionRatio = positions.reduce((sum, position) => sum + position.positionRatio, 0);
  const maxPositionRatio = positions.reduce((max, position) => Math.max(max, position.positionRatio), 0);
  const planFollowedCount = weeklyTrades.filter((trade) => isPositivePlanFollowed(trade.planFollowed)).length;
  const planNotFollowedCount = weeklyTrades.filter((trade) => isNegativePlanFollowed(trade.planFollowed)).length;
  const exitReviewCount = weeklyTrades.filter((trade) => isClosingAction(getTradeAction(trade)) && trade.exitReview).length;
  const lessonCount = weeklyTrades.filter((trade) => trade.lessonLearned).length;
  const portfolioAtCost = calculateEstimatedPortfolioAtCost(
    trades,
    preferences?.account_total_amount,
    exchangeRates
  );

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    weekStart,
    weekEnd,
    accountTotalAmount: preferences?.account_total_amount || null,
    totalTradeCount: trades.length,
    weeklyTradeCount: weeklyTrades.length,
    currentPositionCount: positions.length,
    totalPositionRatio,
    maxPositionRatio,
    ...portfolioAtCost,
    actionCounts: countByAction(trades),
    weeklyActionCounts: countByAction(weeklyTrades),
    tagCounts: countByTag(trades),
    weeklyTagCounts: countByTag(weeklyTrades),
    weeklyBuyAmountCny: sumTradeAmountByAction(weeklyTrades, isOpeningAction, exchangeRates),
    weeklySellAmountCny: sumTradeAmountByAction(weeklyTrades, isClosingAction, exchangeRates),
    planFollowedCount,
    planNotFollowedCount,
    exitReviewCount,
    lessonCount,
    topPositions: positions.slice(0, 5).map((position) => ({
      stockName: position.stockName,
      stockCode: position.stockCode,
      market: position.market,
      positionRatio: position.positionRatio,
      averageCost: position.averageCost
    }))
  } satisfies WeeklyReportSnapshot;
}
