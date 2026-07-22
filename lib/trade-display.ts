import type { Trade, TradeAction } from "@/lib/supabase";

export const tradeActions: TradeAction[] = ["买入", "清仓", "做T买入", "做T卖出"];

export function isOpeningAction(action: TradeAction) {
  return action === "买入" || action === "做T买入";
}

export function isClosingAction(action: TradeAction) {
  return action === "清仓" || action === "做T卖出";
}

export function getTradeAction(trade: Trade) {
  if ((trade.action as string) === "卖出") {
    return "清仓";
  }

  return trade.action || "买入";
}

export function getActionTone(action: TradeAction) {
  if (action === "清仓" || action === "做T卖出") {
    return "bg-red-50 text-red-600";
  }

  if (action === "做T买入") {
    return "bg-indigo-50 text-indigo-600";
  }

  return "bg-blue-50 text-primary";
}

export function getPriceLabel(action: TradeAction) {
  return isClosingAction(action) ? "卖出价" : "买入价";
}

export function getDateLabel(action: TradeAction) {
  return isClosingAction(action) ? "卖出日期" : "买入日期";
}

export function getStatusForAction(action: TradeAction) {
  return isClosingAction(action) ? "已卖出" : "持仓中";
}
