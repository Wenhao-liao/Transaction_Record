"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  convertTradeAmountToCny,
  getCurrencyForMarket,
  getCurrencyLabel,
  type ExchangeRates
} from "@/lib/currency";
import { fetchExchangeRatesOnly, getCachedExchangeRates, normalizeQuoteSymbol } from "@/lib/quotes";
import { createTradeId } from "@/lib/trade-id";
import {
  getDateLabel,
  getPriceLabel,
  getStatusForAction,
  getTradeAction,
  isOpeningAction,
  tradeActions
} from "@/lib/trade-display";
import {
  AuthRequiredError,
  createTrade,
  DatabaseMigrationRequiredError,
  loadJournalData,
  SupabaseConfigError
} from "@/lib/trades-api";
import type { Trade, TradeAction, TradeType } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const tradeTypes = ["趋势交易", "反弹交易", "长期投资", "事件驱动", "止盈", "止损"];
const tradeTagOptions = [
  "追高",
  "左侧买入",
  "财报后",
  "情绪交易",
  "计划内交易",
  "临时起意",
  "突破买入",
  "回调低吸",
  "止损纪律",
  "止盈纪律"
];

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function reduceShares(shares: number[], sharesToReduce: number) {
  let remaining = sharesToReduce;

  return shares
    .map((item) => {
      if (remaining <= 0) {
        return item;
      }

      const reduced = Math.min(item, remaining);
      remaining -= reduced;
      return item - reduced;
    })
    .filter((item) => item > 0);
}

function calculateRemainingShares(trades: Trade[], stockCode: string, market: string) {
  const targetSymbol = normalizeQuoteSymbol(stockCode, market);
  const lots: number[] = [];

  [...trades].reverse().forEach((trade) => {
    if (normalizeQuoteSymbol(trade.stockCode, trade.market) !== targetSymbol) {
      return;
    }

    const action = getTradeAction(trade);
    const shares = trade.buyPrice > 0 ? trade.tradeAmount / trade.buyPrice : 0;

    if (action === "清仓") {
      lots.length = 0;
    } else if (isOpeningAction(action) && shares > 0) {
      lots.push(shares);
    } else if (action === "做T卖出" && shares > 0) {
      const nextLots = reduceShares(lots, shares);
      lots.length = 0;
      lots.push(...nextLots);
    }
  });

  return lots.reduce((sum, item) => sum + item, 0);
}

export default function NewTradePage() {
  const router = useRouter();
  const [action, setAction] = useState<TradeAction>("买入");
  const [tradeType, setTradeType] = useState<TradeType>("趋势交易");
  const [stockCodeInput, setStockCodeInput] = useState("");
  const [marketInput, setMarketInput] = useState("美股");
  const [priceInput, setPriceInput] = useState("");
  const [shareQuantityInput, setShareQuantityInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accountTotalAmount, setAccountTotalAmount] = useState<number | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(() => getCachedExchangeRates());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isBuyAction = action === "买入" || action === "做T买入";
  const isClearAction = action === "清仓";
  const isExitAction = action === "清仓" || action === "做T卖出";
  const shouldShowTradePlan = action === "买入";
  const availableTradeTypes = isExitAction ? ["止盈", "止损"] : tradeTypes;
  const currency = getCurrencyForMarket(marketInput);
  const currencyLabel = getCurrencyLabel(currency);
  const remainingShares = useMemo(
    () => calculateRemainingShares(trades, stockCodeInput, marketInput),
    [marketInput, stockCodeInput, trades]
  );
  const estimatedClearAmount = useMemo(() => {
    const price = Number(priceInput);

    if (!isClearAction || !price || remainingShares <= 0) {
      return null;
    }

    return remainingShares * price;
  }, [isClearAction, priceInput, remainingShares]);
  const estimatedTradeAmount = useMemo(() => {
    const price = Number(priceInput);
    const shares = Number(shareQuantityInput);

    if (isClearAction || !price || !shares) {
      return null;
    }

    return price * shares;
  }, [isClearAction, priceInput, shareQuantityInput]);
  const calculatedPositionRatio = useMemo(() => {
    const tradeAmount = estimatedClearAmount ?? estimatedTradeAmount;

    if (!tradeAmount || !accountTotalAmount) {
      return null;
    }

    return (convertTradeAmountToCny(tradeAmount, marketInput, exchangeRates) / accountTotalAmount) * 100;
  }, [accountTotalAmount, estimatedClearAmount, estimatedTradeAmount, exchangeRates, marketInput]);
  const estimatedTradeAmountCny = useMemo(() => {
    const tradeAmount = estimatedClearAmount ?? estimatedTradeAmount;

    return tradeAmount ? convertTradeAmountToCny(tradeAmount, marketInput, exchangeRates) : null;
  }, [estimatedClearAmount, estimatedTradeAmount, exchangeRates, marketInput]);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const journalData = await loadJournalData();
        setAccountTotalAmount(journalData.preferences.account_total_amount);
        setTrades(journalData.trades);
      } catch (error) {
        if (error instanceof AuthRequiredError) {
          router.push("/login");
        } else if (error instanceof SupabaseConfigError) {
          setMessage("Supabase 尚未配置，请先设置环境变量。");
        }
      }
    }

    void loadPreferences();
  }, [router]);

  useEffect(() => {
    fetchExchangeRatesOnly()
      .then((result) => setExchangeRates(result.exchangeRates))
      .catch(() => setExchangeRates(getCachedExchangeRates()));
  }, []);

  function handleActionChange(nextAction: TradeAction) {
    setAction(nextAction);

    if ((nextAction === "清仓" || nextAction === "做T卖出") && tradeType !== "止盈" && tradeType !== "止损") {
      setTradeType("止盈");
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag) ? currentTags.filter((item) => item !== tag) : [...currentTags, tag]
    );
  }

  async function saveTrade(form: HTMLFormElement) {
    const formData = new FormData(form);
    const stockName = String(formData.get("stockName") || "").trim();
    const stockCode = String(formData.get("stockCode") || "").trim().toUpperCase();
    const sector = String(formData.get("sector") || "").trim();
    const tags = formData
      .getAll("tags")
      .map((tag) => String(tag).trim())
      .filter(Boolean);
    const action = String(formData.get("action") || "买入") as TradeAction;
    const buyPrice = Number(formData.get("buyPrice") || 0);
    const shareQuantity = Number(formData.get("shareQuantity") || 0);
    const tradeAmount = action === "清仓" ? estimatedClearAmount || 0 : buyPrice * shareQuantity;

    if (!stockName || !stockCode || !buyPrice || !tradeAmount) {
      setMessage(
        action === "清仓"
          ? "请填写股票信息和卖出价，且确保该股票存在可清仓持仓。"
          : "请完整填写股票信息、价格和股数。"
      );
      return;
    }

    if (!accountTotalAmount) {
      setMessage("请先到“我的”里设置本金，再保存交易。");
      return;
    }

    if (action === "做T卖出") {
      if (remainingShares <= 0) {
        setMessage("没有找到该股票的当前持仓，请检查股票代码和市场。");
        return;
      }

      if (shareQuantity > remainingShares) {
        setMessage(`做T卖出股数不能超过当前估算剩余 ${remainingShares.toFixed(2)} 股。`);
        return;
      }
    }

    const positionRatio = (convertTradeAmountToCny(tradeAmount, String(formData.get("market") || "美股"), exchangeRates) / accountTotalAmount) * 100;

    const trade: Trade = {
      id: createTradeId(stockCode),
      stockName,
      stockCode,
      market: String(formData.get("market") || "美股"),
      sector,
      tags,
      buyPrice,
      tradeAmount,
      buyDate: String(formData.get("buyDate") || new Date().toISOString().slice(0, 10)),
      action,
      tradeType: tradeType,
      whyNow: String(formData.get("whyNow") || "").trim(),
      bullishFactors: String(formData.get("bullishFactors") || "").trim(),
      riskFactors: String(formData.get("riskFactors") || "").trim(),
      invalidation: String(formData.get("invalidation") || "").trim(),
      targetReturn: String(formData.get("targetReturn") || "").trim(),
      holdingPeriod: String(formData.get("holdingPeriod") || "").trim(),
      stopLossPrice: Number(formData.get("stopLossPrice") || 0),
      positionRatio: `${positionRatio.toFixed(2)}%`,
      status: getStatusForAction(action),
      currentReturn: "0%",
      planFollowed: String(formData.get("planFollowed") || "").trim(),
      exitReview: String(formData.get("exitReview") || "").trim(),
      lessonLearned: String(formData.get("lessonLearned") || "").trim()
    };

    setIsSaving(true);
    setMessage("");

    try {
      await createTrade(trade);
      router.push("/");
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        router.push("/login");
        return;
      }

      if (error instanceof SupabaseConfigError) {
        setMessage("Supabase 尚未配置，请先设置环境变量。");
        return;
      }

      if (error instanceof DatabaseMigrationRequiredError) {
        setMessage("保存失败：请先在 Supabase SQL Editor 重新执行 supabase/schema.sql，补齐闭环复盘字段。");
        return;
      }

      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveTrade(event.currentTarget);
  }

  function handleSaveClick(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;

    if (!form) {
      return;
    }

    if (!form.reportValidity()) {
      return;
    }

    void saveTrade(form);
  }

  return (
    <AppShell>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/95 px-5 py-4 backdrop-blur">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-sm font-medium text-slate-500">记录一次交易动作</p>
          <h1 className="text-xl font-bold text-slate-950">新建交易</h1>
        </div>
      </header>

      <form className="space-y-4 px-5 py-5" onSubmit={handleSubmit}>
        <Card className="border-0">
          <CardHeader>
            <CardTitle>股票信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="操作类型">
              <div className="grid grid-cols-2 gap-2">
                {tradeActions.map((item) => (
                  <label
                    key={item}
                    className="flex h-11 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-slate-600 has-[:checked]:border-primary has-[:checked]:bg-blue-50 has-[:checked]:text-primary"
                  >
                    <input
                      className="sr-only"
                      name="action"
                      type="radio"
                      value={item}
                      checked={action === item}
                      onChange={() => handleActionChange(item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="股票名称">
              <Input name="stockName" placeholder="例如：英伟达" required />
            </Field>
            <Field label="行业/主题">
              <Input name="sector" placeholder="例如：半导体、AI、互联网" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="股票代码">
                <Input
                  name="stockCode"
                  onChange={(event) => setStockCodeInput(event.target.value.toUpperCase())}
                  placeholder="NVDA"
                  required
                  value={stockCodeInput}
                />
              </Field>
              <Field label="市场">
                <Select name="market" onChange={(event) => setMarketInput(event.target.value)} value={marketInput}>
                  <option>美股</option>
                  <option>港股</option>
                  <option>A股</option>
                  <option>其他</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${getPriceLabel(action)}（${currencyLabel}）`}>
                <Input
                  inputMode="decimal"
                  name="buyPrice"
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder="128.40"
                  required
                  value={priceInput}
                />
              </Field>
              <Field label={getDateLabel(action)}>
                <Input name="buyDate" type="date" />
              </Field>
            </div>
            {isClearAction ? (
              <div className="rounded-2xl bg-blue-50 p-4">
                <input name="tradeAmount" type="hidden" value={estimatedClearAmount?.toFixed(2) || ""} />
                <p className="text-sm font-bold text-slate-950">清仓金额</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {stockCodeInput
                    ? remainingShares > 0
                      ? `当前估算剩余 ${remainingShares.toFixed(2)} 股，输入${currencyLabel}卖出价后自动计算`
                      : "没有找到该股票的当前持仓，请检查股票代码和市场"
                    : "填写股票代码和卖出价后自动估算清仓金额"}
                </p>
                <p className="mt-3 text-2xl font-bold text-primary">
                  {estimatedClearAmount === null ? "自动计算" : `${currencyLabel} ${estimatedClearAmount.toFixed(2)}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {calculatedPositionRatio === null
                    ? "仓位比例将按最新汇率折算人民币后自动计算"
                    : `折合人民币 ${estimatedTradeAmountCny?.toFixed(2) || "0.00"}，对应仓位 ${calculatedPositionRatio.toFixed(2)}%`}
                </p>
              </div>
            ) : (
              <Field label="股数">
                <Input
                  inputMode="decimal"
                  name="shareQuantity"
                  onChange={(event) => setShareQuantityInput(event.target.value)}
                  placeholder="例如：100"
                  required
                  value={shareQuantityInput}
                />
                <p className="text-xs leading-5 text-slate-500">
                  {action === "做T卖出" && stockCodeInput
                    ? remainingShares > 0
                      ? `当前估算可卖 ${remainingShares.toFixed(2)} 股；${
                          estimatedTradeAmount === null
                            ? `填写${currencyLabel}价格和股数后自动计算金额`
                            : `${currencyLabel}成交金额 ${estimatedTradeAmount.toFixed(2)}，折合人民币 ${
                                estimatedTradeAmountCny?.toFixed(2) || "0.00"
                              }，仓位 ${calculatedPositionRatio?.toFixed(2) || "0.00"}%`
                        }`
                      : "没有找到该股票的当前持仓，请检查股票代码和市场"
                    : accountTotalAmount
                      ? estimatedTradeAmount === null
                        ? `本金 ${accountTotalAmount}，填写${currencyLabel}价格和股数后自动计算金额`
                        : `${currencyLabel}成交金额 ${estimatedTradeAmount.toFixed(2)}，折合人民币 ${
                            estimatedTradeAmountCny?.toFixed(2) || "0.00"
                          }，仓位 ${calculatedPositionRatio?.toFixed(2) || "0.00"}%`
                      : "请先到“我的”里设置本金"}
                </p>
              </Field>
            )}
            <Field label="交易类型">
              <div className="grid grid-cols-2 gap-2">
                {availableTradeTypes.map((type) => (
                  <label
                    key={type}
                    className="flex h-11 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-slate-600 has-[:checked]:border-primary has-[:checked]:bg-blue-50 has-[:checked]:text-primary"
                  >
                    <input
                      className="sr-only"
                      name="tradeType"
                      type="radio"
                      value={type}
                      checked={tradeType === type}
                      onChange={() => setTradeType(type as TradeType)}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="交易标签">
              <div className="flex flex-wrap gap-2">
                {tradeTagOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);

                  return (
                    <button
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-semibold transition",
                        isSelected ? "border-primary bg-blue-50 text-primary" : "border-slate-200 bg-white text-slate-500"
                      )}
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              {selectedTags.map((tag) => (
                <input key={tag} name="tags" type="hidden" value={tag} />
              ))}
              <p className="text-xs leading-5 text-slate-500">
                标签会帮助 AI 在复盘时识别你容易出错的交易场景。
              </p>
            </Field>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader>
            <CardTitle>交易逻辑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={isBuyAction ? "为什么现在买？" : "为什么现在卖？"}>
              <Textarea
                name="whyNow"
                placeholder={
                  isBuyAction
                    ? "触发买入的价格、趋势、基本面或情绪信号。"
                    : "为什么选择现在清仓或做T卖出？"
                }
              />
            </Field>
            {!isExitAction && (
              <>
                <Field label="风险因素">
                  <Textarea name="riskFactors" placeholder="写下估值、行业、财报、流动性等潜在风险。" />
                </Field>
                <Field label="什么情况证明我错？">
                  <Textarea name="invalidation" placeholder="提前定义失效条件，避免临场找理由。" />
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        {shouldShowTradePlan && (
          <Card className="border-0">
            <CardHeader>
              <CardTitle>交易计划</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="目标收益">
                  <Input name="targetReturn" placeholder="18%" />
                </Field>
                <Field label="预计持有时间">
                  <Input name="holdingPeriod" placeholder="4-8 周" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="止损价格">
                  <Input inputMode="decimal" name="stopLossPrice" placeholder="119.80" />
                </Field>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-sm text-slate-500">仓位比例</p>
                  <p className="mt-1 font-bold text-slate-950">
                    {calculatedPositionRatio === null ? "自动计算" : `${calculatedPositionRatio.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isExitAction && (
          <Card className="border-0">
            <CardHeader>
              <CardTitle>闭环复盘</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="是否按原计划执行？">
                <Select name="planFollowed" defaultValue="">
                  <option value="">请选择</option>
                  <option value="符合计划">符合计划</option>
                  <option value="部分符合">部分符合</option>
                  <option value="偏离计划">偏离计划</option>
                </Select>
              </Field>
              <Field label="这次卖出复盘">
                <Textarea
                  name="exitReview"
                  placeholder="例如：是否达到止盈/止损条件？有没有提前卖、拖延卖，或者临时改变计划？"
                />
              </Field>
              <Field label="下次要改进什么？">
                <Textarea name="lessonLearned" placeholder="写下这笔交易给你的规则、纪律或观察清单。" />
              </Field>
            </CardContent>
          </Card>
        )}

        <div className="sticky bottom-[5.75rem] z-20">
          {message ? <p className="mb-3 rounded-2xl bg-white p-3 text-center text-sm text-red-500 shadow-ios">{message}</p> : null}
          <Button
            className="h-14 w-full rounded-3xl text-base shadow-ios"
            disabled={isSaving}
            onClick={handleSaveClick}
            type="button"
          >
            {isSaving ? "保存中..." : "保存交易日志"}
          </Button>
        </div>
      </form>

      <BottomNav current="/trades/new" />
    </AppShell>
  );
}
