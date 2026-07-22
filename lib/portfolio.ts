import { normalizeQuoteSymbol, type Quote } from "@/lib/quotes";
import { convertTradeAmountToCny, getExchangeRateForMarket, type ExchangeRates } from "@/lib/currency";
import { getTradeAction, isOpeningAction } from "@/lib/trade-display";
import type { Trade } from "@/lib/supabase";

type PortfolioLot = {
  shares: number;
  price: number;
  market: string;
  quoteSymbol: string;
};

export type PortfolioMetrics = {
  principal: number;
  cashBalance: number;
  marketValue: number;
  totalAssets: number;
  totalProfit: number;
  totalProfitPercent: number;
  hasEstimatedMarketValue: boolean;
};

function getTradeSortValue(trade: Trade) {
  const timestamp = Number(trade.id.split("-").at(-1));
  return `${trade.buyDate}-${Number.isFinite(timestamp) ? timestamp : 0}`;
}

function reduceLots(lots: PortfolioLot[], sharesToReduce: number) {
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

export function calculatePortfolioMetrics(
  trades: Trade[],
  principal: number | null | undefined,
  quotes: Record<string, Quote>,
  exchangeRates?: ExchangeRates | null
) {
  if (!principal || principal <= 0) {
    return null;
  }

  let cashBalance = principal;
  let hasEstimatedMarketValue = false;
  const lotsBySymbol = new Map<string, PortfolioLot[]>();

  [...trades]
    .sort((a, b) => getTradeSortValue(a).localeCompare(getTradeSortValue(b)))
    .forEach((trade) => {
      const action = getTradeAction(trade);
      const quoteSymbol = normalizeQuoteSymbol(trade.stockCode, trade.market);
      const shares = trade.buyPrice > 0 ? trade.tradeAmount / trade.buyPrice : 0;
      const tradeAmountCny = convertTradeAmountToCny(trade.tradeAmount, trade.market, exchangeRates);
      const currentLots = lotsBySymbol.get(quoteSymbol) || [];

      if (isOpeningAction(action)) {
        cashBalance -= tradeAmountCny;

        if (shares > 0) {
          lotsBySymbol.set(quoteSymbol, [...currentLots, { shares, price: trade.buyPrice, market: trade.market, quoteSymbol }]);
        }
        return;
      }

      cashBalance += tradeAmountCny;

      if (action === "清仓") {
        lotsBySymbol.set(quoteSymbol, []);
        return;
      }

      if (action === "做T卖出" && shares > 0) {
        lotsBySymbol.set(quoteSymbol, reduceLots(currentLots, shares));
      }
    });

  const marketValue = Array.from(lotsBySymbol.values())
    .flat()
    .reduce((sum, lot) => {
      const currentPrice = quotes[lot.quoteSymbol]?.currentPrice;

      if (!currentPrice) {
        hasEstimatedMarketValue = true;
      }

      return sum + lot.shares * (currentPrice || lot.price) * getExchangeRateForMarket(lot.market, exchangeRates);
    }, 0);

  const totalAssets = cashBalance + marketValue;
  const totalProfit = totalAssets - principal;

  return {
    principal,
    cashBalance,
    marketValue,
    totalAssets,
    totalProfit,
    totalProfitPercent: (totalProfit / principal) * 100,
    hasEstimatedMarketValue
  } satisfies PortfolioMetrics;
}
