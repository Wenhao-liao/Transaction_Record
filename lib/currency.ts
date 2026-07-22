export type CurrencyCode = "CNY" | "HKD" | "USD";

export type ExchangeRates = Record<CurrencyCode, number>;

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  CNY: 1,
  HKD: 0.92,
  USD: 7.2
};

export function getCurrencyForMarket(market: string): CurrencyCode {
  if (market === "港股") {
    return "HKD";
  }

  if (market === "美股") {
    return "USD";
  }

  return "CNY";
}

export function getCurrencyLabel(currency: CurrencyCode) {
  if (currency === "HKD") {
    return "港币";
  }

  if (currency === "USD") {
    return "美元";
  }

  return "人民币";
}

export function getExchangeRateForMarket(market: string, rates?: Partial<ExchangeRates> | null) {
  const currency = getCurrencyForMarket(market);
  return rates?.[currency] || DEFAULT_EXCHANGE_RATES[currency];
}

export function convertTradeAmountToCny(
  amount: number,
  market: string,
  rates?: Partial<ExchangeRates> | null
) {
  return amount * getExchangeRateForMarket(market, rates);
}
