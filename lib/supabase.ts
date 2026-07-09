import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type TradeType = "趋势交易" | "反弹交易" | "长期投资" | "事件驱动";

export type Trade = {
  id: string;
  stockName: string;
  stockCode: string;
  market: string;
  buyPrice: number;
  buyDate: string;
  tradeType: TradeType;
  whyNow: string;
  bullishFactors: string;
  riskFactors: string;
  invalidation: string;
  targetReturn: string;
  holdingPeriod: string;
  stopLossPrice: number;
  positionRatio: string;
  status: "持仓中" | "已卖出";
  currentReturn: string;
};
