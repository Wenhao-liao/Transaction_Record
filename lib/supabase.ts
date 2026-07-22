import { createClient } from "@supabase/supabase-js";
import type { WeeklyReportSnapshot } from "@/lib/weekly-report-snapshot";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseAnonKey || "public-anon-key"
);

export type TradeType = "趋势交易" | "反弹交易" | "长期投资" | "事件驱动" | "止盈" | "止损";
export type TradeAction = "买入" | "清仓" | "做T买入" | "做T卖出";

export type Trade = {
  id: string;
  stockName: string;
  stockCode: string;
  market: string;
  sector: string;
  tags: string[];
  buyPrice: number;
  tradeAmount: number;
  buyDate: string;
  action: TradeAction;
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
  planFollowed: string;
  exitReview: string;
  lessonLearned: string;
};

export type TradeRow = {
  id: string;
  user_id: string;
  stock_name: string;
  stock_code: string;
  market: string;
  sector: string | null;
  tags: string[] | null;
  buy_price: number;
  trade_amount: number | null;
  buy_date: string;
  action: TradeAction | "卖出";
  trade_type: TradeType;
  why_now: string | null;
  bullish_factors: string | null;
  risk_factors: string | null;
  invalidation: string | null;
  target_return: string | null;
  holding_period: string | null;
  stop_loss_price: number | null;
  position_ratio: string | null;
  status: "持仓中" | "已卖出";
  current_return: string | null;
  plan_followed: string | null;
  exit_review: string | null;
  lesson_learned: string | null;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  id: string;
  user_id: string;
  weekly_report_day: string;
  weekly_report_time: string;
  report_tone: string;
  account_total_amount: number | null;
  review_reminder_enabled: boolean;
  return_color_mode: "red_up_green_down" | "green_up_red_down";
  created_at: string;
  updated_at: string;
};

export type WeeklyReport = {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  title: string;
  summary: string;
  content: string;
  snapshot: WeeklyReportSnapshot | null;
  created_at: string;
  updated_at: string;
};
