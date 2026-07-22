import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { DEFAULT_EXCHANGE_RATES } from "@/lib/currency";
import { buildCurrentPositions } from "@/lib/positions";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl, type Trade, type UserPreferences } from "@/lib/supabase";
import { getStatusForAction } from "@/lib/trade-display";
import { buildWeeklyReportSnapshot } from "@/lib/weekly-report-snapshot";

export const dynamic = "force-dynamic";

const principal = 200000;

function toTradeInsert(trade: Trade, userId: string) {
  return {
    id: trade.id,
    user_id: userId,
    stock_name: trade.stockName,
    stock_code: trade.stockCode,
    market: trade.market,
    sector: trade.sector || null,
    tags: trade.tags,
    buy_price: trade.buyPrice,
    trade_amount: trade.tradeAmount,
    buy_date: trade.buyDate,
    action: trade.action,
    trade_type: trade.tradeType,
    why_now: trade.whyNow,
    bullish_factors: trade.bullishFactors,
    risk_factors: trade.riskFactors,
    invalidation: trade.invalidation,
    target_return: trade.targetReturn,
    holding_period: trade.holdingPeriod,
    stop_loss_price: trade.stopLossPrice || null,
    position_ratio: trade.positionRatio,
    status: trade.status,
    current_return: trade.currentReturn,
    plan_followed: trade.planFollowed,
    exit_review: trade.exitReview,
    lesson_learned: trade.lessonLearned
  };
}

function createSeedTrade(trade: Omit<Trade, "status" | "currentReturn">): Trade {
  return {
    ...trade,
    status: getStatusForAction(trade.action),
    currentReturn: "0%"
  };
}

const seedTrades: Trade[] = [
  createSeedTrade({
    id: "seed-nvda-buy-20260701",
    stockName: "英伟达",
    stockCode: "NVDA",
    market: "美股",
    sector: "半导体",
    tags: ["追高", "财报后", "计划内交易"],
    buyPrice: 123,
    tradeAmount: 9840,
    buyDate: "2026-07-01",
    action: "买入",
    tradeType: "趋势交易",
    whyNow: "财报后高开回落又重新站上 5 日线，AI 算力主线仍是市场最强方向。",
    bullishFactors: "",
    riskFactors: "估值较高，若市场风险偏好下降，龙头也可能出现快速回撤。",
    invalidation: "跌破 116 且两个交易日无法收回。",
    targetReturn: "15%",
    holdingPeriod: "4-8 周",
    stopLossPrice: 116,
    positionRatio: "35.42%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-tsm-buy-20260703",
    stockName: "台积电",
    stockCode: "TSM",
    market: "美股",
    sector: "半导体",
    tags: ["突破买入", "计划内交易"],
    buyPrice: 184,
    tradeAmount: 5520,
    buyDate: "2026-07-03",
    action: "买入",
    tradeType: "长期投资",
    whyNow: "突破前高后回踩不破，先进制程需求仍有支撑。",
    bullishFactors: "",
    riskFactors: "半导体周期和汇率波动会影响估值。",
    invalidation: "跌破 170 后放量下行。",
    targetReturn: "20%",
    holdingPeriod: "3-6 个月",
    stopLossPrice: 170,
    positionRatio: "19.87%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-0700-buy-20260704",
    stockName: "腾讯控股",
    stockCode: "0700",
    market: "港股",
    sector: "互联网",
    tags: ["左侧买入", "回调低吸", "计划内交易"],
    buyPrice: 380,
    tradeAmount: 38000,
    buyDate: "2026-07-04",
    action: "买入",
    tradeType: "长期投资",
    whyNow: "回到长期估值区间下沿，回购和现金流提供一定安全边际。",
    bullishFactors: "",
    riskFactors: "港股整体流动性较弱，政策和风险偏好变化会压制估值。",
    invalidation: "核心业务增长连续低于预期，且回购明显放缓。",
    targetReturn: "18%",
    holdingPeriod: "6-12 个月",
    stopLossPrice: 350,
    positionRatio: "17.48%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-9988-buy-20260705",
    stockName: "阿里巴巴-W",
    stockCode: "9988",
    market: "港股",
    sector: "互联网",
    tags: ["左侧买入", "临时起意"],
    buyPrice: 78,
    tradeAmount: 23400,
    buyDate: "2026-07-05",
    action: "买入",
    tradeType: "反弹交易",
    whyNow: "连续下跌后出现放量反弹，判断短期可能修复。",
    bullishFactors: "",
    riskFactors: "买入较临时，缺少明确二次确认信号。",
    invalidation: "跌回 74 以下并持续缩量。",
    targetReturn: "10%",
    holdingPeriod: "2-4 周",
    stopLossPrice: 74,
    positionRatio: "10.76%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-600519-buy-20260706",
    stockName: "贵州茅台",
    stockCode: "600519",
    market: "A股",
    sector: "消费",
    tags: ["左侧买入", "计划内交易"],
    buyPrice: 1450,
    tradeAmount: 43500,
    buyDate: "2026-07-06",
    action: "买入",
    tradeType: "长期投资",
    whyNow: "估值回到历史偏低区域，分批配置消费龙头。",
    bullishFactors: "",
    riskFactors: "消费复苏节奏较慢，渠道价格需要持续跟踪。",
    invalidation: "渠道价格继续下行且基本面确认恶化。",
    targetReturn: "12%",
    holdingPeriod: "6-12 个月",
    stopLossPrice: 1380,
    positionRatio: "21.75%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-300750-buy-20260707",
    stockName: "宁德时代",
    stockCode: "300750",
    market: "A股",
    sector: "新能源",
    tags: ["回调低吸", "情绪交易"],
    buyPrice: 205,
    tradeAmount: 24600,
    buyDate: "2026-07-07",
    action: "买入",
    tradeType: "反弹交易",
    whyNow: "新能源板块连续调整后出现反弹，想捕捉短线修复。",
    bullishFactors: "",
    riskFactors: "板块趋势仍弱，反弹可能持续性不足。",
    invalidation: "跌破 196 且板块无资金回流。",
    targetReturn: "10%",
    holdingPeriod: "2-4 周",
    stopLossPrice: 196,
    positionRatio: "12.30%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-nvda-t-sell-20260710",
    stockName: "英伟达",
    stockCode: "NVDA",
    market: "美股",
    sector: "半导体",
    tags: ["止盈纪律", "计划内交易"],
    buyPrice: 132,
    tradeAmount: 2640,
    buyDate: "2026-07-10",
    action: "做T卖出",
    tradeType: "止盈",
    whyNow: "短线涨幅过快，先卖出一部分锁定波段收益。",
    bullishFactors: "",
    riskFactors: "",
    invalidation: "",
    targetReturn: "",
    holdingPeriod: "",
    stopLossPrice: 0,
    positionRatio: "9.50%",
    planFollowed: "符合计划",
    exitReview: "按计划在快速拉升后卖出一部分，降低追高后的波动压力。",
    lessonLearned: "强趋势里可以分批止盈，不需要一次性卖完。"
  }),
  createSeedTrade({
    id: "seed-0700-t-buy-20260711",
    stockName: "腾讯控股",
    stockCode: "0700",
    market: "港股",
    sector: "互联网",
    tags: ["回调低吸", "计划内交易"],
    buyPrice: 366,
    tradeAmount: 18300,
    buyDate: "2026-07-11",
    action: "做T买入",
    tradeType: "反弹交易",
    whyNow: "回踩 20 日线附近缩量，尝试加一笔做T仓位。",
    bullishFactors: "",
    riskFactors: "若港股情绪继续走弱，补仓可能扩大短线波动。",
    invalidation: "跌破 350 且无法快速收回。",
    targetReturn: "",
    holdingPeriod: "",
    stopLossPrice: 350,
    positionRatio: "8.42%",
    planFollowed: "",
    exitReview: "",
    lessonLearned: ""
  }),
  createSeedTrade({
    id: "seed-9988-clear-20260712",
    stockName: "阿里巴巴-W",
    stockCode: "9988",
    market: "港股",
    sector: "互联网",
    tags: ["止损纪律", "临时起意"],
    buyPrice: 73,
    tradeAmount: 21900,
    buyDate: "2026-07-12",
    action: "清仓",
    tradeType: "止损",
    whyNow: "跌破原定失效位，且反弹没有量能配合。",
    bullishFactors: "",
    riskFactors: "",
    invalidation: "",
    targetReturn: "",
    holdingPeriod: "",
    stopLossPrice: 0,
    positionRatio: "10.07%",
    planFollowed: "偏离计划",
    exitReview: "买入时偏临时，止损位设置后没有第一时间执行，最终亏损扩大。",
    lessonLearned: "临时起意的交易必须降低仓位，且止损触发后不能拖延。"
  }),
  createSeedTrade({
    id: "seed-300750-clear-20260716",
    stockName: "宁德时代",
    stockCode: "300750",
    market: "A股",
    sector: "新能源",
    tags: ["止损纪律", "情绪交易"],
    buyPrice: 195,
    tradeAmount: 23400,
    buyDate: "2026-07-16",
    action: "清仓",
    tradeType: "止损",
    whyNow: "新能源反弹失败，跌破预设止损位。",
    bullishFactors: "",
    riskFactors: "",
    invalidation: "",
    targetReturn: "",
    holdingPeriod: "",
    stopLossPrice: 0,
    positionRatio: "11.70%",
    planFollowed: "部分符合",
    exitReview: "方向判断过早，属于情绪驱动的抢反弹。",
    lessonLearned: "弱势行业做反弹时，必须等量能确认后再扩大仓位。"
  })
];

function buildReportContent(title: string, summary: string) {
  return `# ${title}

## 核心复盘
- ${summary}
- 本期数据来自测试种子，覆盖 A股、港股、美股、做T、清仓、标签和行业集中风险。

## 后续关注
- 观察半导体仓位是否过于集中。
- 检查“临时起意”和“情绪交易”标签下的交易是否更容易偏离计划。
- 触及止损价时，优先执行预案而不是重新解释。`;
}

function buildWeeklyReport({
  weekStart,
  weekEnd,
  title,
  summary,
  trades,
  userId,
  preferences
}: {
  weekStart: string;
  weekEnd: string;
  title: string;
  summary: string;
  trades: Trade[];
  userId: string;
  preferences: UserPreferences;
}) {
  const weeklyTrades = trades.filter((trade) => trade.buyDate >= weekStart && trade.buyDate <= weekEnd);
  const positions = buildCurrentPositions(trades.filter((trade) => trade.buyDate <= weekEnd), principal, DEFAULT_EXCHANGE_RATES);
  const snapshot = buildWeeklyReportSnapshot({
    trades: trades.filter((trade) => trade.buyDate <= weekEnd),
    weeklyTrades,
    positions,
    preferences,
    weekStart,
    weekEnd,
    exchangeRates: DEFAULT_EXCHANGE_RATES
  });

  return {
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    title,
    summary,
    content: buildReportContent(title, summary),
    snapshot
  };
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "测试数据接口仅开发环境可用" }, { status: 404 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase 尚未配置" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") || "";

  if (!authorization) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization
      }
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const userId = userData.user.id;
    const preferences = {
      user_id: userId,
      weekly_report_day: "Sunday",
      weekly_report_time: "20:00",
      account_total_amount: principal,
      review_reminder_enabled: false,
      return_color_mode: "red_up_green_down"
    };

    await supabase.from("trades").delete().eq("user_id", userId).like("id", "seed-%");
    await supabase.from("weekly_reports").delete().eq("user_id", userId).like("title", "测试周报%");

    const { error: preferencesError } = await supabase
      .from("user_preferences")
      .upsert(preferences, { onConflict: "user_id" });

    if (preferencesError) {
      throw preferencesError;
    }

    const { error: tradesError } = await supabase.from("trades").insert(seedTrades.map((trade) => toTradeInsert(trade, userId)));

    if (tradesError) {
      throw tradesError;
    }

    const reportPreferences = {
      id: "",
      user_id: userId,
      weekly_report_day: "Sunday",
      weekly_report_time: "20:00",
      report_tone: "简洁、直接、可执行",
      account_total_amount: principal,
      review_reminder_enabled: false,
      return_color_mode: "red_up_green_down",
      created_at: "",
      updated_at: ""
    } satisfies UserPreferences;
    const reports = [
      buildWeeklyReport({
        weekStart: "2026-07-06",
        weekEnd: "2026-07-12",
        title: "测试周报：跨市场交易复盘",
        summary: "本周开始建立 A股、港股、美股组合，半导体和互联网仓位较集中。",
        trades: seedTrades,
        userId,
        preferences: reportPreferences
      }),
      buildWeeklyReport({
        weekStart: "2026-07-13",
        weekEnd: "2026-07-19",
        title: "测试周报：止损纪律与标签复盘",
        summary: "本周出现清仓止损记录，情绪交易和临时起意标签需要重点跟踪。",
        trades: seedTrades,
        userId,
        preferences: reportPreferences
      })
    ];
    const { error: reportsError } = await supabase.from("weekly_reports").insert(reports);

    if (reportsError) {
      throw reportsError;
    }

    return NextResponse.json({
      insertedTrades: seedTrades.length,
      insertedReports: reports.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "测试数据生成失败"
      },
      { status: 500 }
    );
  }
}
