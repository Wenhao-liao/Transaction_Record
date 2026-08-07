import https from "https";
import { NextResponse } from "next/server";
import { normalizeQuoteSymbol, type Quote, type QuotesResponse } from "@/lib/quotes";
import { DEFAULT_EXCHANGE_RATES, type ExchangeRates } from "@/lib/currency";

export const dynamic = "force-dynamic";

const EASTMONEY_QUOTE_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get";
const EASTMONEY_FIELDS = "f2,f12,f18";
const SINA_QUOTE_URL = "https://hq.sinajs.cn/list=";
const TENCENT_QUOTE_URL = "https://qt.gtimg.cn/q=";
const EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/CNY";

type QuoteRequest = {
  symbol: string;
  market?: string;
};

type EastmoneyQuoteItem = {
  f2?: number | string;
  f12?: string;
  f18?: number | string;
};

type EastmoneyQuoteResponse = {
  data?: {
    diff?: EastmoneyQuoteItem[];
  } | null;
};

type ExchangeRateResponse = {
  result?: string;
  rates?: {
    HKD?: number;
    USD?: number;
  };
};

function requestText(url: URL, referer: string) {
  return new Promise<string>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "Accept-Encoding": "identity",
          Referer: referer,
          "User-Agent": "Mozilla/5.0"
        }
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("行情请求失败"));
            return;
          }

          resolve(body);
        });
      }
    );

    request.on("error", () => {
      reject(new Error("行情请求失败"));
    });
    request.setTimeout(8000, () => {
      request.destroy(new Error("行情请求超时"));
    });
  });
}

async function requestJson<T>(url: URL) {
  const body = await requestText(url, "https://quote.eastmoney.com/");

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("东方财富行情解析失败");
  }
}

function parseQuoteRequest(value: string) {
  const [maybeMarket, ...rest] = value.split(":");

  if (rest.length === 0) {
    return {
      symbol: normalizeQuoteSymbol(value)
    };
  }

  const rawSymbol = rest.join(":");

  return {
    market: maybeMarket,
    symbol: normalizeQuoteSymbol(rawSymbol, maybeMarket)
  };
}

function isAshareRequest(request: QuoteRequest) {
  return request.market === "A股" || (!request.market && /^\d{6}$/.test(request.symbol));
}

function isHongKongRequest(request: QuoteRequest) {
  return request.market === "港股";
}

function isUsRequest(request: QuoteRequest) {
  return request.market === "美股" || /^[A-Z][A-Z0-9.-]*$/.test(request.symbol);
}

function toEastmoneySecid(symbol: string) {
  const normalized = normalizeQuoteSymbol(symbol);
  const upperSymbol = symbol.toUpperCase();

  if (upperSymbol.startsWith("SH.") || /^[569]/.test(normalized)) {
    return `1.${normalized}`;
  }

  if (upperSymbol.startsWith("SZ.") || /^[023]/.test(normalized)) {
    return `0.${normalized}`;
  }

  if (upperSymbol.startsWith("BJ.") || /^[48]/.test(normalized)) {
    return `0.${normalized}`;
  }

  return `0.${normalized}`;
}

function toTencentSymbol(request: QuoteRequest) {
  if (isHongKongRequest(request)) {
    return `hk${request.symbol.padStart(5, "0")}`;
  }

  return `us${request.symbol.replace(".", ".").toUpperCase()}`;
}

function toSinaSymbol(symbol: string) {
  const normalized = normalizeQuoteSymbol(symbol);

  if (/^[569]/.test(normalized)) {
    return `sh${normalized}`;
  }

  if (/^[48]/.test(normalized)) {
    return `bj${normalized}`;
  }

  return `sz${normalized}`;
}

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (!value || value === "-") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchEastmoneyQuotes(symbols: string[]) {
  const url = new URL(EASTMONEY_QUOTE_URL);
  url.searchParams.set("fltt", "2");
  url.searchParams.set("fields", EASTMONEY_FIELDS);
  url.searchParams.set("secids", symbols.map(toEastmoneySecid).join(","));
  url.searchParams.set("_", String(Date.now()));

  const data = await requestJson<EastmoneyQuoteResponse>(url);

  return (data.data?.diff || []).reduce<Record<string, Quote>>((acc, item) => {
    const symbol = normalizeQuoteSymbol(item.f12 || "");

    if (!symbol) {
      return acc;
    }

    acc[symbol] = {
      symbol,
      currentPrice: toNumber(item.f2),
      previousClose: toNumber(item.f18),
      updatedAt: Date.now()
    };

    return acc;
  }, {});
}

async function fetchSinaQuotes(symbols: string[]) {
  const url = new URL(SINA_QUOTE_URL + symbols.map(toSinaSymbol).join(","));
  const body = await requestText(url, "https://finance.sina.com.cn/");
  const quotes: Record<string, Quote> = {};
  const quotePattern = /var hq_str_([a-z]{2})(\d{6})="([^"]*)";/gi;
  let match: RegExpExecArray | null;

  while ((match = quotePattern.exec(body))) {
    const symbol = normalizeQuoteSymbol(match[2]);
    const fields = match[3].split(",");
    const previousClose = toNumber(fields[2]);
    const currentPrice = toNumber(fields[3]);

    if (!symbol) {
      continue;
    }

    quotes[symbol] = {
      symbol,
      currentPrice,
      previousClose,
      updatedAt: Date.now()
    };
  }

  return quotes;
}

async function fetchTencentQuotes(requests: QuoteRequest[]) {
  const querySymbols = requests.map(toTencentSymbol);
  const requestMap = requests.reduce<Record<string, QuoteRequest>>((acc, request) => {
    const querySymbol = toTencentSymbol(request);
    acc[querySymbol.toLowerCase()] = request;
    return acc;
  }, {});
  const url = new URL(TENCENT_QUOTE_URL + querySymbols.join(","));
  const body = await requestText(url, "https://gu.qq.com/");
  const quotes: Record<string, Quote> = {};
  const quotePattern = /v_([a-zA-Z0-9.]+)="([^"]*)";/g;
  let match: RegExpExecArray | null;

  while ((match = quotePattern.exec(body))) {
    const request = requestMap[match[1].toLowerCase()];
    const fields = match[2].split("~");

    if (!request) {
      continue;
    }

    quotes[request.symbol] = {
      symbol: request.symbol,
      currentPrice: toNumber(fields[3]),
      previousClose: toNumber(fields[4]),
      updatedAt: Date.now()
    };
  }

  return quotes;
}

async function fetchQuotesWithFallback(symbols: string[]) {
  try {
    const eastmoneyQuotes = await fetchEastmoneyQuotes(symbols);
    const missingSymbols = symbols.filter((symbol) => !eastmoneyQuotes[symbol]?.currentPrice);

    if (missingSymbols.length === 0) {
      return eastmoneyQuotes;
    }

    return {
      ...eastmoneyQuotes,
      ...(await fetchSinaQuotes(missingSymbols))
    };
  } catch {
    return fetchSinaQuotes(symbols);
  }
}

async function fetchMarketQuotes(requests: QuoteRequest[]) {
  const ashareSymbols = requests.filter(isAshareRequest).map((request) => request.symbol);
  const globalRequests = requests.filter((request) => !isAshareRequest(request) && (isHongKongRequest(request) || isUsRequest(request)));
  const [ashareQuotes, globalQuotes] = await Promise.all([
    ashareSymbols.length > 0 ? fetchQuotesWithFallback(ashareSymbols) : Promise.resolve({} as Record<string, Quote>),
    globalRequests.length > 0 ? fetchTencentQuotes(globalRequests) : Promise.resolve({} as Record<string, Quote>)
  ]);

  return {
    ...ashareQuotes,
    ...globalQuotes
  };
}

async function fetchExchangeRates() {
  try {
    const data = await requestJson<ExchangeRateResponse>(new URL(EXCHANGE_RATE_URL));
    const cnyToUsd = data.rates?.USD;
    const cnyToHkd = data.rates?.HKD;

    if (!cnyToUsd || !cnyToHkd) {
      return DEFAULT_EXCHANGE_RATES;
    }

    return {
      CNY: 1,
      HKD: 1 / cnyToHkd,
      USD: 1 / cnyToUsd
    } satisfies ExchangeRates;
  } catch {
    return DEFAULT_EXCHANGE_RATES;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requests = (searchParams.get("symbols") || "")
    .split(",")
    .map(parseQuoteRequest)
    .filter((item) => item.symbol)
    .filter((item, index, list) => {
      return list.findIndex((candidate) => candidate.symbol === item.symbol && candidate.market === item.market) === index;
    })
    .slice(0, 50);

  if (requests.length === 0) {
    return NextResponse.json({
      configured: true,
      quotes: {},
      exchangeRates: await fetchExchangeRates()
    } satisfies QuotesResponse);
  }

  try {
    const [quotes, exchangeRates] = await Promise.all([fetchMarketQuotes(requests), fetchExchangeRates()]);

    return NextResponse.json({
      configured: true,
      quotes,
      exchangeRates
    } satisfies QuotesResponse);
  } catch (error) {
    const quotes = requests.reduce<Record<string, Quote>>((acc, request) => {
      acc[request.symbol] = {
        symbol: request.symbol,
        currentPrice: null,
        previousClose: null,
        updatedAt: null,
        error: error instanceof Error ? error.message : "行情请求失败"
      };

      return acc;
    }, {});

    return NextResponse.json({
      configured: true,
      quotes,
      exchangeRates: await fetchExchangeRates()
    } satisfies QuotesResponse);
  }
}
