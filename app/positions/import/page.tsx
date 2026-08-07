"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  convertTradeAmountToCny,
  getCurrencyForMarket,
  getCurrencyLabel,
  type ExchangeRates
} from "@/lib/currency";
import { fetchExchangeRatesOnly, getCachedExchangeRates, normalizeQuoteSymbol } from "@/lib/quotes";
import { createTradeId } from "@/lib/trade-id";
import {
  AuthRequiredError,
  createTrade,
  DatabaseMigrationRequiredError,
  DuplicateInitialPositionError,
  loadJournalData,
  SupabaseConfigError
} from "@/lib/trades-api";
import { isInitialPositionTrade } from "@/lib/trade-display";
import type { Trade } from "@/lib/supabase";

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

export default function ImportInitialPositionPage() {
  const router = useRouter();
  const [marketInput, setMarketInput] = useState("美股");
  const [priceInput, setPriceInput] = useState("");
  const [shareQuantityInput, setShareQuantityInput] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accountTotalAmount, setAccountTotalAmount] = useState<number | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(() => getCachedExchangeRates());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const currency = getCurrencyForMarket(marketInput);
  const currencyLabel = getCurrencyLabel(currency);
  const estimatedTradeAmount = useMemo(() => {
    const price = Number(priceInput);
    const shares = Number(shareQuantityInput);

    if (!price || !shares) {
      return null;
    }

    return price * shares;
  }, [priceInput, shareQuantityInput]);
  const estimatedTradeAmountCny = useMemo(
    () => (estimatedTradeAmount ? convertTradeAmountToCny(estimatedTradeAmount, marketInput, exchangeRates) : null),
    [estimatedTradeAmount, exchangeRates, marketInput]
  );
  const calculatedPositionRatio = useMemo(() => {
    if (!estimatedTradeAmountCny || !accountTotalAmount) {
      return null;
    }

    return (estimatedTradeAmountCny / accountTotalAmount) * 100;
  }, [accountTotalAmount, estimatedTradeAmountCny]);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const stockName = String(formData.get("stockName") || "").trim();
    const stockCode = String(formData.get("stockCode") || "").trim().toUpperCase();
    const sector = String(formData.get("sector") || "").trim();
    const buyPrice = Number(formData.get("buyPrice") || 0);
    const shareQuantity = Number(formData.get("shareQuantity") || 0);
    const tradeAmount = buyPrice * shareQuantity;

    if (!stockName || !stockCode || !buyPrice || !shareQuantity || !tradeAmount) {
      setMessage("请完整填写股票名称、代码、成本价和股数。");
      return;
    }

    if (!accountTotalAmount) {
      setMessage("请先到“我的”里设置本金，再导入初始持仓。");
      return;
    }

    const normalizedSymbol = normalizeQuoteSymbol(stockCode, String(formData.get("market") || "美股"));
    const hasImportedInitialPosition = trades.some(
      (trade) =>
        isInitialPositionTrade(trade) &&
        trade.market === String(formData.get("market") || "美股") &&
        normalizeQuoteSymbol(trade.stockCode, trade.market) === normalizedSymbol
    );

    if (hasImportedInitialPosition) {
      setMessage("这只股票已经导入过初始持仓，请不要重复导入。后续变化请使用新建交易记录。");
      return;
    }

    const positionRatio =
      (convertTradeAmountToCny(tradeAmount, String(formData.get("market") || "美股"), exchangeRates) /
        accountTotalAmount) *
      100;
    const trade: Trade = {
      id: createTradeId(stockCode),
      stockName,
      stockCode,
      market: String(formData.get("market") || "美股"),
      sector,
      tags: ["初始持仓"],
      buyPrice,
      tradeAmount,
      buyDate: String(formData.get("buyDate") || new Date().toISOString().slice(0, 10)),
      action: "初始持仓",
      tradeType: "长期投资",
      whyNow: "建档前已有持仓，导入用于初始化当前仓位。",
      bullishFactors: "",
      riskFactors: "",
      invalidation: "",
      targetReturn: "",
      holdingPeriod: "",
      stopLossPrice: Number(formData.get("stopLossPrice") || 0),
      positionRatio: `${positionRatio.toFixed(2)}%`,
      status: "持仓中",
      currentReturn: "0%",
      planFollowed: "",
      exitReview: "",
      lessonLearned: "",
      isInitialPosition: true
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
        setMessage("保存失败：请先在 Supabase SQL Editor 重新执行 supabase/schema.sql，补齐初始持仓字段。");
        return;
      }

      if (error instanceof DuplicateInitialPositionError) {
        setMessage(error.message);
        return;
      }

      setMessage(error instanceof Error ? error.message : "导入失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/95 px-5 py-4 backdrop-blur">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-sm font-medium text-slate-500">建档前已有仓位</p>
          <h1 className="text-xl font-bold text-slate-950">导入初始持仓</h1>
        </div>
      </header>

      <form className="space-y-4 px-5 py-5" onSubmit={handleSubmit}>
        <Card className="border-0">
          <CardHeader>
            <CardTitle>持仓信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-950">不会进入交易复盘</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    初始持仓只用于还原当前仓位和资产，不会算作本周待复盘交易。
                  </p>
                </div>
              </div>
            </div>

            <Field label="股票名称">
              <Input name="stockName" placeholder="例如：腾讯控股" required />
            </Field>
            <Field label="行业/主题">
              <Input name="sector" placeholder="例如：互联网、AI、消费电子" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="股票代码">
                <Input name="stockCode" placeholder="0700" required />
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
              <Field label={`持仓成本（${currencyLabel}）`}>
                <Input
                  inputMode="decimal"
                  name="buyPrice"
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder="128.40"
                  required
                  value={priceInput}
                />
              </Field>
              <Field label="导入日期">
                <Input name="buyDate" type="date" />
              </Field>
            </div>
            <Field label="当前股数">
              <Input
                inputMode="decimal"
                name="shareQuantity"
                onChange={(event) => setShareQuantityInput(event.target.value)}
                placeholder="例如：100"
                required
                value={shareQuantityInput}
              />
              <p className="text-xs leading-5 text-slate-500">
                {accountTotalAmount
                  ? estimatedTradeAmount === null
                    ? `本金 ${accountTotalAmount}，填写${currencyLabel}成本和股数后自动计算仓位`
                    : `${currencyLabel}持仓成本 ${estimatedTradeAmount.toFixed(2)}，折合人民币 ${
                        estimatedTradeAmountCny?.toFixed(2) || "0.00"
                      }，仓位 ${calculatedPositionRatio?.toFixed(2) || "0.00"}%`
                  : "请先到“我的”里设置本金"}
              </p>
            </Field>
            <Field label={`止损价格（${currencyLabel}，可选）`}>
              <Input inputMode="decimal" name="stopLossPrice" placeholder="例如：115" />
            </Field>
          </CardContent>
        </Card>

        {message ? <p className="px-1 text-sm text-red-500">{message}</p> : null}

        <div className="sticky bottom-20 z-10 rounded-3xl bg-slate-50/90 pb-2 pt-1 backdrop-blur">
          <Button className="w-full" disabled={isSaving} type="submit">
            {isSaving ? "导入中..." : "导入初始持仓"}
          </Button>
        </div>
      </form>

      <BottomNav current="/trade" />
    </AppShell>
  );
}
