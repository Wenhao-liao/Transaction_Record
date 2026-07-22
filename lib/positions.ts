import { normalizeQuoteSymbol } from "@/lib/quotes";
import { convertTradeAmountToCny, type ExchangeRates } from "@/lib/currency";
import type { Trade, TradeAction } from "@/lib/supabase";
import { getTradeAction, isOpeningAction } from "@/lib/trade-display";

type PositionLot = {
  ratio: number;
  price: number;
  stopLossPrice: number;
  sector: string;
};

export type CurrentPosition = {
  stockName: string;
  stockCode: string;
  quoteSymbol: string;
  market: string;
  sector: string;
  positionRatio: number;
  averageCost: number | null;
  stopLossPrice: number | null;
  latestTrade: Trade;
  latestAction: TradeAction;
  tradeIds: string[];
  tradeCount: number;
  tTradeCount: number;
};

export function parsePositionRatio(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getTradePositionRatio(trade: Trade, accountTotalAmount?: number | null, exchangeRates?: ExchangeRates | null) {
  if (trade.tradeAmount && accountTotalAmount && accountTotalAmount > 0) {
    return (convertTradeAmountToCny(trade.tradeAmount, trade.market, exchangeRates) / accountTotalAmount) * 100;
  }

  return parsePositionRatio(trade.positionRatio);
}

function reduceLots(lots: PositionLot[], ratioToReduce: number) {
  let remaining = ratioToReduce;

  return lots
    .map((lot) => {
      if (remaining <= 0) {
        return lot;
      }

      const reduced = Math.min(lot.ratio, remaining);
      remaining -= reduced;

      return {
        ...lot,
        ratio: lot.ratio - reduced
      };
    })
    .filter((lot) => lot.ratio > 0);
}

function calculateAverageCost(lots: PositionLot[]) {
  const totalRatio = lots.reduce((sum, lot) => sum + lot.ratio, 0);

  if (totalRatio <= 0) {
    return null;
  }

  const totalCost = lots.reduce((sum, lot) => sum + lot.ratio * lot.price, 0);
  return totalCost / totalRatio;
}

function toPositionRatio(lots: PositionLot[]) {
  return Math.min(
    100,
    lots.reduce((sum, lot) => sum + lot.ratio, 0)
  );
}

export function buildCurrentPositions(
  trades: Trade[],
  accountTotalAmount?: number | null,
  exchangeRates?: ExchangeRates | null
) {
  const grouped = [...trades].reverse().reduce<Map<string, CurrentPosition & { lots: PositionLot[] }>>((acc, trade) => {
    const quoteSymbol = normalizeQuoteSymbol(trade.stockCode, trade.market);
    const action = getTradeAction(trade);
    const ratio = getTradePositionRatio(trade, accountTotalAmount, exchangeRates);
    const existing =
      acc.get(quoteSymbol) ||
      ({
        stockName: trade.stockName,
        stockCode: trade.stockCode,
        quoteSymbol,
        market: trade.market,
        sector: trade.sector,
        positionRatio: 0,
        averageCost: null,
        stopLossPrice: null,
        latestTrade: trade,
        latestAction: action,
        tradeIds: [],
        tradeCount: 0,
        tTradeCount: 0,
        lots: []
      } satisfies CurrentPosition & { lots: PositionLot[] });

    if (action === "清仓") {
      existing.lots = [];
    } else if (isOpeningAction(action) && ratio > 0) {
      existing.lots.push({
        ratio,
        price: trade.buyPrice,
        stopLossPrice: trade.stopLossPrice,
        sector: trade.sector
      });
    } else if (action === "做T卖出" && ratio > 0) {
      existing.lots = reduceLots(existing.lots, ratio);
    }

    existing.stockName = trade.stockName;
    existing.stockCode = trade.stockCode;
    existing.market = trade.market;
    existing.sector = trade.sector || existing.lots.find((lot) => lot.sector)?.sector || "";
    existing.positionRatio = toPositionRatio(existing.lots);
    existing.averageCost = calculateAverageCost(existing.lots);
    existing.stopLossPrice =
      [...existing.lots]
        .reverse()
        .find((lot) => lot.stopLossPrice > 0)?.stopLossPrice || null;
    existing.latestTrade = trade;
    existing.latestAction = action;
    existing.tradeIds.push(trade.id);
    existing.tradeCount += 1;
    existing.tTradeCount += action.startsWith("做T") ? 1 : 0;

    acc.set(quoteSymbol, existing);
    return acc;
  }, new Map());

  return Array.from(grouped.values())
    .filter((position) => position.positionRatio > 0)
    .sort((a, b) => b.positionRatio - a.positionRatio)
    .map(({ lots, ...position }) => position);
}

export function getTotalPositionRatio(positions: CurrentPosition[]) {
  return positions.reduce((sum, position) => sum + position.positionRatio, 0);
}
