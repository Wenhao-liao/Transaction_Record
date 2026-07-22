import type { CurrentPosition } from "@/lib/positions";
import type { Quote } from "@/lib/quotes";

export type RiskAlertLevel = "danger" | "warning" | "info";
export type RiskAlertType = "stop_loss" | "position_size" | "sector_concentration";

export type RiskAlert = {
  id: string;
  type: RiskAlertType;
  level: RiskAlertLevel;
  title: string;
  description: string;
  symbol?: string;
};

export const RISK_ALERT_HOME_STORAGE_KEY = "trade-journal:hide-risk-alerts-on-home";

const STOP_LOSS_NEAR_THRESHOLD = 1.05;
const HIGH_POSITION_RATIO = 25;
const WATCH_POSITION_RATIO = 20;
const SECTOR_CONCENTRATION_RATIO = 45;
const SECTOR_CONCENTRATION_COUNT = 2;

function formatRatio(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function formatPrice(value: number) {
  return value.toFixed(2);
}

function buildStopLossAlerts(positions: CurrentPosition[], quotes: Record<string, Quote>) {
  return positions.flatMap<RiskAlert>((position) => {
    const currentPrice = quotes[position.quoteSymbol]?.currentPrice;

    if (!position.stopLossPrice || !currentPrice) {
      return [];
    }

    if (currentPrice <= position.stopLossPrice) {
      return [
        {
          id: `stop-loss-breached-${position.quoteSymbol}`,
          type: "stop_loss",
          level: "danger",
          title: `${position.stockName} 已触及止损价`,
          description: `现价 ${formatPrice(currentPrice)}，止损价 ${formatPrice(position.stopLossPrice)}，建议优先复核交易计划。`,
          symbol: position.quoteSymbol
        }
      ];
    }

    if (currentPrice <= position.stopLossPrice * STOP_LOSS_NEAR_THRESHOLD) {
      const distance = ((currentPrice - position.stopLossPrice) / position.stopLossPrice) * 100;

      return [
        {
          id: `stop-loss-near-${position.quoteSymbol}`,
          type: "stop_loss",
          level: "warning",
          title: `${position.stockName} 接近止损价`,
          description: `现价距离止损价约 ${distance.toFixed(1)}%，可以提前想好执行条件。`,
          symbol: position.quoteSymbol
        }
      ];
    }

    return [];
  });
}

function buildPositionSizeAlerts(positions: CurrentPosition[]) {
  return positions.flatMap<RiskAlert>((position) => {
    if (position.positionRatio >= HIGH_POSITION_RATIO) {
      return [
        {
          id: `position-high-${position.quoteSymbol}`,
          type: "position_size",
          level: "warning",
          title: `${position.stockName} 单只仓位过高`,
          description: `当前仓位 ${formatRatio(position.positionRatio)}，已经超过 ${HIGH_POSITION_RATIO}%，需要确认是否符合你的风险承受范围。`,
          symbol: position.quoteSymbol
        }
      ];
    }

    if (position.positionRatio >= WATCH_POSITION_RATIO) {
      return [
        {
          id: `position-watch-${position.quoteSymbol}`,
          type: "position_size",
          level: "info",
          title: `${position.stockName} 仓位偏集中`,
          description: `当前仓位 ${formatRatio(position.positionRatio)}，接近单票集中提醒线。`,
          symbol: position.quoteSymbol
        }
      ];
    }

    return [];
  });
}

function buildSectorConcentrationAlerts(positions: CurrentPosition[]) {
  const sectorGroups = positions.reduce<Record<string, CurrentPosition[]>>((acc, position) => {
    const sector = position.sector.trim();

    if (!sector) {
      return acc;
    }

    acc[sector] = [...(acc[sector] || []), position];
    return acc;
  }, {});

  return Object.entries(sectorGroups).flatMap<RiskAlert>(([sector, groupedPositions]) => {
    const totalRatio = groupedPositions.reduce((sum, position) => sum + position.positionRatio, 0);

    if (groupedPositions.length < SECTOR_CONCENTRATION_COUNT || totalRatio < SECTOR_CONCENTRATION_RATIO) {
      return [];
    }

    const stockNames = groupedPositions
      .slice()
      .sort((a, b) => b.positionRatio - a.positionRatio)
      .slice(0, 3)
      .map((position) => position.stockName)
      .join("、");

    return [
      {
        id: `sector-concentration-${sector}`,
        type: "sector_concentration",
        level: totalRatio >= 60 ? "warning" : "info",
        title: `${sector} 暴露较集中`,
        description: `${groupedPositions.length} 只持仓合计 ${formatRatio(totalRatio)}，主要包括 ${stockNames}。`,
      }
    ];
  });
}

export function buildRiskAlerts(positions: CurrentPosition[], quotes: Record<string, Quote>) {
  return [
    ...buildStopLossAlerts(positions, quotes),
    ...buildPositionSizeAlerts(positions),
    ...buildSectorConcentrationAlerts(positions)
  ].sort((a, b) => {
    const levelWeight: Record<RiskAlertLevel, number> = {
      danger: 0,
      warning: 1,
      info: 2
    };

    return levelWeight[a.level] - levelWeight[b.level];
  });
}

export function getRiskAlertTone(level: RiskAlertLevel) {
  if (level === "danger") {
    return "bg-red-50 text-red-600";
  }

  if (level === "warning") {
    return "bg-amber-50 text-amber-600";
  }

  return "bg-blue-50 text-primary";
}

export function getRiskAlertTypeLabel(type: RiskAlertType) {
  if (type === "stop_loss") {
    return "止损提醒";
  }

  if (type === "position_size") {
    return "仓位提醒";
  }

  return "行业集中";
}

export function shouldHideRiskAlertsOnHome() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(RISK_ALERT_HOME_STORAGE_KEY) === "true";
}

export function setHideRiskAlertsOnHome(shouldHide: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (shouldHide) {
    window.localStorage.setItem(RISK_ALERT_HOME_STORAGE_KEY, "true");
  } else {
    window.localStorage.removeItem(RISK_ALERT_HOME_STORAGE_KEY);
  }
}
