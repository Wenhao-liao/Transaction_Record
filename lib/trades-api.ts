import { normalizeQuoteSymbol } from "@/lib/quotes";
import { isSupabaseConfigured, supabase, type Trade, type TradeRow, type UserPreferences } from "@/lib/supabase";
import { isInitialPositionTrade } from "@/lib/trade-display";

type JournalData = {
  trades: Trade[];
  preferences: UserPreferences;
};

let cachedTrades: Trade[] | null = null;
let cachedPreferences: UserPreferences | null = null;
let journalDataRequest: Promise<JournalData> | null = null;

export class SupabaseConfigError extends Error {
  constructor() {
    super("Supabase is not configured");
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("User is not authenticated");
  }
}

export class DatabaseMigrationRequiredError extends Error {
  constructor() {
    super("数据库字段还没有更新，请在 Supabase SQL Editor 重新执行 supabase/schema.sql。");
  }
}

export class DuplicateInitialPositionError extends Error {
  constructor() {
    super("这只股票已经导入过初始持仓，请不要重复导入。后续变化请使用新建交易记录。");
  }
}

function isMissingMigrationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return (
    code === "PGRST204" ||
    message.includes("account_total_amount") ||
    message.includes("return_color_mode") ||
    message.includes("sector") ||
    message.includes("tags") ||
    message.includes("trade_amount") ||
    message.includes("plan_followed") ||
    message.includes("exit_review") ||
    message.includes("lesson_learned") ||
    message.includes("is_initial_position") ||
    message.includes("schema cache") ||
    message.includes("Could not find")
  );
}

function isInitialPositionCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return (
    isMissingMigrationError(error) ||
    code === "23514" ||
    message.includes("trades_action_check") ||
    message.includes("violates check constraint")
  );
}

async function getCurrentUserId() {
  if (!isSupabaseConfigured) {
    throw new SupabaseConfigError();
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new AuthRequiredError();
  }

  return data.user.id;
}

function normalizeAction(action: TradeRow["action"]) {
  return action === "卖出" ? "清仓" : action;
}

export function tradeFromRow(row: TradeRow): Trade {
  const tags = row.tags || [];

  return {
    id: row.id,
    stockName: row.stock_name,
    stockCode: row.stock_code,
    market: row.market,
    sector: row.sector || "",
    tags,
    buyPrice: row.buy_price,
    tradeAmount: row.trade_amount || 0,
    buyDate: row.buy_date,
    action: normalizeAction(row.action),
    tradeType: row.trade_type,
    whyNow: row.why_now || "",
    bullishFactors: row.bullish_factors || "",
    riskFactors: row.risk_factors || "",
    invalidation: row.invalidation || "",
    targetReturn: row.target_return || "",
    holdingPeriod: row.holding_period || "",
    stopLossPrice: row.stop_loss_price || 0,
    positionRatio: row.position_ratio || "",
    status: row.status,
    currentReturn: row.current_return || "0%",
    planFollowed: row.plan_followed || "",
    exitReview: row.exit_review || "",
    lessonLearned: row.lesson_learned || "",
    isInitialPosition: Boolean(row.is_initial_position || row.action === "初始持仓" || tags.includes("初始持仓"))
  };
}

function preferencesFromRow(row: UserPreferences) {
  return {
    ...row,
    account_total_amount: row.account_total_amount || null,
    return_color_mode: row.return_color_mode || "red_up_green_down"
  } satisfies UserPreferences;
}

export function getCachedJournalData() {
  if (!cachedTrades || !cachedPreferences) {
    return null;
  }

  return {
    trades: cachedTrades,
    preferences: cachedPreferences
  };
}

export function clearJournalDataCache() {
  cachedTrades = null;
  cachedPreferences = null;
  journalDataRequest = null;
}

function tradeToInsert(trade: Trade, userId: string) {
  return {
    id: trade.id,
    user_id: userId,
    stock_name: trade.stockName,
    stock_code: trade.stockCode,
    market: trade.market,
    sector: trade.sector || null,
    tags: trade.tags || [],
    buy_price: trade.buyPrice,
    trade_amount: trade.tradeAmount || null,
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
    lesson_learned: trade.lessonLearned,
    is_initial_position: trade.isInitialPosition
  };
}

function initialPositionToCompatibleInsert(trade: Trade, userId: string) {
  return {
    ...tradeToInsert(trade, userId),
    action: "买入",
    tags: Array.from(new Set([...(trade.tags || []), "初始持仓"])),
    why_now: trade.whyNow || "建档前已有持仓，导入用于初始化当前仓位。",
    is_initial_position: undefined
  };
}

async function assertNoDuplicateInitialPosition(trade: Trade) {
  const targetSymbol = normalizeQuoteSymbol(trade.stockCode, trade.market);
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("market", trade.market);

  if (error) {
    throw error;
  }

  const hasDuplicate = ((data || []) as TradeRow[])
    .map(tradeFromRow)
    .some(
      (item) =>
        isInitialPositionTrade(item) && normalizeQuoteSymbol(item.stockCode, item.market) === targetSymbol
    );

  if (hasDuplicate) {
    throw new DuplicateInitialPositionError();
  }
}

export async function listTrades() {
  await getCurrentUserId();

  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("buy_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const trades = ((data || []) as TradeRow[]).map(tradeFromRow);
  cachedTrades = trades;

  return trades;
}

export async function getTrade(id: string) {
  await getCurrentUserId();

  const { data, error } = await supabase.from("trades").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? tradeFromRow(data as TradeRow) : null;
}

export async function listTradesByStockCode(stockCode: string) {
  await getCurrentUserId();

  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("stock_code", stockCode)
    .order("buy_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data || []) as TradeRow[]).map(tradeFromRow);
}

export async function createTrade(trade: Trade) {
  const userId = await getCurrentUserId();

  if (trade.isInitialPosition) {
    await assertNoDuplicateInitialPosition(trade);
  }

  const { error } = await supabase.from("trades").insert(tradeToInsert(trade, userId));

  if (error) {
    if (trade.isInitialPosition && isInitialPositionCompatibilityError(error)) {
      const { error: fallbackError } = await supabase
        .from("trades")
        .insert(initialPositionToCompatibleInsert(trade, userId));

      if (!fallbackError) {
        cachedTrades = cachedTrades ? [trade, ...cachedTrades] : null;
        return;
      }

      if (!isInitialPositionCompatibilityError(fallbackError)) {
        throw fallbackError;
      }
    }

    if (isMissingMigrationError(error)) {
      throw new DatabaseMigrationRequiredError();
    }

    throw error;
  }

  cachedTrades = cachedTrades ? [trade, ...cachedTrades] : null;
}

export async function deleteTrades(ids: string[]) {
  await getCurrentUserId();

  if (ids.length === 0) {
    return;
  }

  const { error } = await supabase.from("trades").delete().in("id", ids);

  if (error) {
    throw error;
  }

  cachedTrades = cachedTrades ? cachedTrades.filter((trade) => !ids.includes(trade.id)) : null;
}

export async function resetJournalData() {
  const userId = await getCurrentUserId();

  const [{ error: tradesError }, { error: reportsError }] = await Promise.all([
    supabase.from("trades").delete().eq("user_id", userId),
    supabase.from("weekly_reports").delete().eq("user_id", userId)
  ]);

  if (tradesError) {
    throw tradesError;
  }

  if (reportsError) {
    throw reportsError;
  }

  cachedTrades = [];
  journalDataRequest = null;
}

export async function getOrCreatePreferences() {
  const userId = await getCurrentUserId();

  const { data: existing, error: selectError } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const preferences = preferencesFromRow(existing as UserPreferences);
    cachedPreferences = preferences;
    return preferences;
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .insert({
      user_id: userId,
      weekly_report_day: "Sunday",
      weekly_report_time: "20:00",
      report_tone: "简洁、直接、可执行",
      review_reminder_enabled: false,
      return_color_mode: "red_up_green_down"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const preferences = preferencesFromRow(data as UserPreferences);
  cachedPreferences = preferences;

  return preferences;
}

export async function loadJournalData({ force = false } = {}) {
  const cached = getCachedJournalData();

  if (!force && cached) {
    return cached;
  }

  if (!force && journalDataRequest) {
    return journalDataRequest;
  }

  journalDataRequest = Promise.all([listTrades(), getOrCreatePreferences()])
    .then(([trades, preferences]) => {
      cachedTrades = trades;
      cachedPreferences = preferences;

      return {
        trades,
        preferences
      };
    })
    .finally(() => {
      journalDataRequest = null;
    });

  return journalDataRequest;
}

export async function updatePreferences(
  input: Partial<
    Pick<
      UserPreferences,
      "account_total_amount" | "weekly_report_day" | "weekly_report_time" | "review_reminder_enabled" | "return_color_mode"
    >
  >
) {
  const userId = await getCurrentUserId();
  await getOrCreatePreferences();

  const { data, error } = await supabase
    .from("user_preferences")
    .update(input)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    if (isMissingMigrationError(error)) {
      throw new DatabaseMigrationRequiredError();
    }

    throw error;
  }

  const preferences = preferencesFromRow(data as UserPreferences);
  cachedPreferences = preferences;

  return preferences;
}
