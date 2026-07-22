import type { Trade } from "@/lib/supabase";
import { DEFAULT_EXCHANGE_RATES, type ExchangeRates } from "@/lib/currency";

export type Quote = {
  symbol: string;
  currentPrice: number | null;
  previousClose: number | null;
  updatedAt: number | null;
  error?: string;
};

export type QuotesResponse = {
  configured: boolean;
  quotes: Record<string, Quote>;
  exchangeRates: ExchangeRates;
};

export type QuoteInput = string | { symbol: string; market?: string };

const QUOTE_CACHE_TTL = 60 * 1000;
let quoteMemoryCache: Record<string, Quote> = {};
let exchangeRateMemoryCache: ExchangeRates | null = null;

export function normalizeQuoteSymbol(symbol: string, market?: string) {
  const normalized = symbol.trim().toUpperCase().replace(/\s+/g, "");

  if (market === "港股") {
    const hkCode = normalized.match(/\d{3,5}/)?.[0];
    return hkCode ? String(Number(hkCode)).padStart(4, "0") : normalized.replace(/^(HK)[.]?/, "").replace(/[.](HK)$/, "");
  }

  if (market === "美股") {
    return normalized.replace(/[.](US|NASDAQ|NYSE|AMEX)$/, "");
  }

  const ashareCode = normalized.match(/\d{6}/)?.[0];

  if (ashareCode) {
    return ashareCode;
  }

  return normalized.replace(/^(SH|SZ|BJ)[.]?/, "").replace(/[.](SH|SZ|BJ)$/, "");
}

function normalizeQuoteInput(input: QuoteInput) {
  if (typeof input === "string") {
    return normalizeQuoteSymbol(input);
  }

  return normalizeQuoteSymbol(input.symbol, input.market);
}

function serializeQuoteInput(input: QuoteInput) {
  if (typeof input === "string") {
    return normalizeQuoteSymbol(input);
  }

  return input.market ? `${input.market}:${normalizeQuoteSymbol(input.symbol, input.market)}` : normalizeQuoteSymbol(input.symbol);
}

function readSessionQuoteCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const value = window.sessionStorage.getItem("trade-journal:quotes");
    return value ? (JSON.parse(value) as Record<string, Quote>) : {};
  } catch {
    return {};
  }
}

function writeSessionQuoteCache(quotes: Record<string, Quote>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem("trade-journal:quotes", JSON.stringify(quotes));
  } catch {
    // Ignore storage failures; live quotes can still be fetched normally.
  }
}

function readSessionExchangeRateCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem("trade-journal:exchange-rates");
    return value ? (JSON.parse(value) as ExchangeRates) : null;
  } catch {
    return null;
  }
}

function writeSessionExchangeRateCache(rates: ExchangeRates) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem("trade-journal:exchange-rates", JSON.stringify(rates));
  } catch {
    // Ignore storage failures; exchange rates can be fetched again.
  }
}

function mergeQuoteCache(quotes: Record<string, Quote>) {
  quoteMemoryCache = {
    ...readSessionQuoteCache(),
    ...quoteMemoryCache,
    ...quotes
  };
  writeSessionQuoteCache(quoteMemoryCache);
}

function mergeExchangeRateCache(rates: ExchangeRates) {
  exchangeRateMemoryCache = rates;
  writeSessionExchangeRateCache(rates);
}

export function getCachedExchangeRates() {
  return exchangeRateMemoryCache || readSessionExchangeRateCache() || DEFAULT_EXCHANGE_RATES;
}

export function getCachedQuotes(symbols: QuoteInput[]) {
  const uniqueSymbols = Array.from(new Set(symbols.map(normalizeQuoteInput).filter(Boolean)));
  const allQuotes = {
    ...readSessionQuoteCache(),
    ...quoteMemoryCache
  };

  return uniqueSymbols.reduce<Record<string, Quote>>((acc, symbol) => {
    const quote = allQuotes[symbol];

    if (quote?.currentPrice) {
      acc[symbol] = quote;
    }

    return acc;
  }, {});
}

function areQuotesFresh(quotes: Record<string, Quote>, symbols: string[]) {
  const now = Date.now();

  return symbols.every((symbol) => {
    const quote = quotes[symbol];
    return Boolean(quote?.currentPrice && quote.updatedAt && now - quote.updatedAt < QUOTE_CACHE_TTL);
  });
}

export function calculateReturnPercent(trade: Trade, quote?: Quote) {
  if (!quote?.currentPrice || !trade.buyPrice) {
    return null;
  }

  return ((quote.currentPrice - trade.buyPrice) / trade.buyPrice) * 100;
}

export function formatReturnPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "暂无行情";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatPrice(value: number | null | undefined) {
  if (!value) {
    return "暂无";
  }

  return value.toFixed(2);
}

export async function fetchQuotes(symbols: QuoteInput[]) {
  const uniqueSymbols = Array.from(new Set(symbols.map(normalizeQuoteInput).filter(Boolean)));
  const requestSymbols = Array.from(new Set(symbols.map(serializeQuoteInput).filter(Boolean)));

  if (uniqueSymbols.length === 0) {
    return fetchExchangeRatesOnly();
  }

  const cachedQuotes = getCachedQuotes(uniqueSymbols);

  if (areQuotesFresh(cachedQuotes, uniqueSymbols)) {
    return { configured: true, quotes: cachedQuotes, exchangeRates: getCachedExchangeRates() } satisfies QuotesResponse;
  }

  const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(requestSymbols.join(","))}`);

  if (!response.ok) {
    throw new Error("Failed to fetch quotes");
  }

  const result = (await response.json()) as QuotesResponse;
  mergeQuoteCache(result.quotes);
  mergeExchangeRateCache(result.exchangeRates);

  return {
    ...result,
    quotes: {
      ...cachedQuotes,
      ...result.quotes
    }
  };
}

export async function fetchExchangeRatesOnly() {
  const response = await fetch("/api/quotes?symbols=");

  if (!response.ok) {
    return {
      configured: true,
      quotes: {},
      exchangeRates: getCachedExchangeRates()
    } satisfies QuotesResponse;
  }

  const result = (await response.json()) as QuotesResponse;
  mergeExchangeRateCache(result.exchangeRates);

  return result;
}
