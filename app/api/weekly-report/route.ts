import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentWeekRange } from "@/lib/date-range";
import { buildCurrentPositions } from "@/lib/positions";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl, type TradeRow, type UserPreferences } from "@/lib/supabase";
import { isReviewableTrade } from "@/lib/trade-display";
import { tradeFromRow } from "@/lib/trades-api";
import { buildWeeklyReportSnapshot } from "@/lib/weekly-report-snapshot";

export const dynamic = "force-dynamic";

const DEFAULT_OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function extractOutputText(data: OpenAIResponse) {
  if (data.output_text) {
    return data.output_text.trim();
  }

  return (
    data.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text || "")
      .join("\n")
      .trim() || ""
  );
}

function buildPrompt(payload: unknown) {
  return `请基于以下个人投资交易日志数据，生成一份中文 AI 周报。

你可以自由组织内容结构，不需要使用固定模板。请像一位严谨、有实战经验的投资复盘助手一样，帮助用户理解本周交易质量、持仓状态、决策模式和后续行动。

要求：
1. 可以结合股票、市场、行业、宏观等公开网络信息进行分析；如果当前模型或服务不具备联网能力，请明确说明无法实时查询网络数据，并只基于用户提供的数据进行复盘。
2. 可以提供买入、卖出、减仓、加仓、继续观察、止盈、止损等交易建议，但必须说明建议依据、触发条件和主要风险。
3. 不要编造具体行情、价格、财务数据或新闻事件；无法确认的数据要标注为不确定。
4. 请重点关注：本周交易总结、当前持仓风险、用户决策习惯、仓位是否合理、哪些交易值得继续跟踪、哪些情况需要及时纠错。
5. 输出 Markdown，结构可以自行发挥，语言要清晰、具体、有判断力，避免空泛套话。
6. 这不是正式投资顾问意见，最后请保留必要的风险提示。

数据：
${JSON.stringify(payload, null, 2)}`;
}

function getModelCandidates() {
  const primaryModel = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const fallbackModels = (process.env.OPENAI_FALLBACK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return Array.from(new Set([primaryModel, ...fallbackModels]));
}

function formatAiProviderError(message: string, model: string) {
  if (message.includes("no available channels for model") || message.includes("has no available channels")) {
    return `当前 AI 中转服务没有为模型 ${model} 提供可用通道。请把 OPENAI_MODEL 改成中转平台支持的模型，或配置 OPENAI_FALLBACK_MODELS。原始错误：${message}`;
  }

  if (message.includes("model") && (message.includes("not found") || message.includes("does not exist"))) {
    return `当前 AI 模型 ${model} 不存在或未开通。请检查 OPENAI_MODEL 是否与中转平台模型名称一致。原始错误：${message}`;
  }

  return message;
}

function getResponsesUrl() {
  const baseUrl = (process.env.OPENAI_API_BASE_URL || process.env.API_BASE_URL || DEFAULT_OPENAI_API_BASE_URL).trim();
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/responses")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/responses`;
}

function getChatCompletionsUrl() {
  const baseUrl = (process.env.OPENAI_API_BASE_URL || process.env.API_BASE_URL || DEFAULT_OPENAI_API_BASE_URL).trim();
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  if (normalizedBaseUrl.endsWith("/responses")) {
    return `${normalizedBaseUrl.replace(/\/responses$/, "")}/chat/completions`;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

function getAiHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

function shouldFallbackToChatCompletion(status: number) {
  return status === 400 || status === 404 || status === 405;
}

async function readAiError(response: Response) {
  try {
    const data = (await response.json()) as { error?: { message?: string } | string; message?: string };

    if (typeof data.error === "string") {
      return data.error;
    }

    return data.error?.message || data.message || "AI 周报生成失败";
  } catch {
    return "AI 周报生成失败";
  }
}

async function generateWithResponsesApi(apiKey: string, model: string, payload: unknown) {
  const response = await fetch(getResponsesUrl(), {
    method: "POST",
    headers: getAiHeaders(apiKey),
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "你是一名谨慎、客观的投资交易复盘助手。你的输出仅用于个人复盘，不构成投资建议。"
        },
        {
          role: "user",
          content: buildPrompt(payload)
        }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const message = await readAiError(response);
    return {
      content: "",
      shouldFallback: shouldFallbackToChatCompletion(response.status),
      error: formatAiProviderError(message, model)
    };
  }

  const data = (await response.json()) as OpenAIResponse;
  return {
    content: extractOutputText(data),
    shouldFallback: false,
    error: ""
  };
}

async function generateWithChatCompletionsApi(apiKey: string, model: string, payload: unknown) {
  const response = await fetch(getChatCompletionsUrl(), {
    method: "POST",
    headers: getAiHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是一名谨慎、客观的投资交易复盘助手。你的输出仅用于个人复盘，不构成投资建议。"
        },
        {
          role: "user",
          content: buildPrompt(payload)
        }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error(formatAiProviderError(await readAiError(response), model));
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function generateReportContent(payload: unknown) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 尚未配置");
  }

  const errors: string[] = [];

  for (const model of getModelCandidates()) {
    try {
      const responsesResult = await generateWithResponsesApi(apiKey, model, payload);
      const content =
        responsesResult.content ||
        (responsesResult.shouldFallback ? await generateWithChatCompletionsApi(apiKey, model, payload) : "");

      if (content) {
        return content;
      }

      errors.push(responsesResult.error || `模型 ${model} 返回内容为空`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `模型 ${model} 生成失败`);
    }
  }

  throw new Error(errors[0] || "AI 周报内容为空");
}

export async function POST(request: Request) {
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

  const { weekStart, weekEnd } = getCurrentWeekRange();

  try {
    const [{ data: tradesData, error: tradesError }, { data: preferencesData, error: preferencesError }] =
      await Promise.all([
        supabase
          .from("trades")
          .select("*")
          .order("buy_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("user_preferences").select("*").eq("user_id", userData.user.id).maybeSingle()
      ]);

    if (tradesError) {
      throw tradesError;
    }

    if (preferencesError) {
      throw preferencesError;
    }

    const trades = ((tradesData || []) as TradeRow[]).map(tradeFromRow);
    const reviewableTrades = trades.filter(isReviewableTrade);
    const weeklyTrades = reviewableTrades.filter((trade) => trade.buyDate >= weekStart && trade.buyDate <= weekEnd);
    const preferences = preferencesData as UserPreferences | null;
    const positions = buildCurrentPositions(trades, preferences?.account_total_amount);
    const snapshot = buildWeeklyReportSnapshot({
      trades,
      weeklyTrades,
      positions,
      preferences,
      weekStart,
      weekEnd
    });
    const payload = {
      weekStart,
      weekEnd,
      accountTotalAmount: preferences?.account_total_amount || null,
      snapshot,
      tradeCount: reviewableTrades.length,
      weeklyTrades,
      currentPositions: positions.map((position) => ({
        stockName: position.stockName,
        stockCode: position.stockCode,
        market: position.market,
        positionRatio: position.positionRatio,
        averageCost: position.averageCost,
        latestAction: position.latestAction,
        tradeCount: position.tradeCount,
        tTradeCount: position.tTradeCount
      }))
    };

    const content = await generateReportContent(payload);
    const summary = content
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" / ");
    const title = `${weekStart} 至 ${weekEnd} AI 周报`;

    const { data: report, error: reportError } = await supabase
      .from("weekly_reports")
      .upsert(
        {
          user_id: userData.user.id,
          week_start: weekStart,
          week_end: weekEnd,
          title,
          summary: summary || "本周 AI 交易复盘已生成",
          content,
          snapshot
        },
        { onConflict: "user_id,week_start" }
      )
      .select("*")
      .single();

    if (reportError) {
      throw reportError;
    }

    return NextResponse.json({ id: report.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI 周报生成失败"
      },
      { status: 500 }
    );
  }
}
