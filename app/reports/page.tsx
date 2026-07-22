"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  GitCompare,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount } from "@/lib/money";
import type { WeeklyReport } from "@/lib/supabase";
import { AuthRequiredError, SupabaseConfigError } from "@/lib/trades-api";
import { listWeeklyReports } from "@/lib/weekly-reports-api";
import { cn } from "@/lib/utils";

function cleanPreviewText(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("```"))
    .join(" ")
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function getReportPlainText(report: WeeklyReport) {
  return cleanPreviewText([report.title, report.summary, report.content].filter(Boolean).join("\n"));
}

function getReportKeywords(report: WeeklyReport) {
  const text = getReportPlainText(report);
  const candidates = Array.from(
    new Set(
      text.match(/[A-Z]{2,6}|\d{6}|HK\d{3,5}|[\u4e00-\u9fa5]{2,6}/g)?.filter((word) => {
        return !["本周", "周报", "交易", "复盘", "建议", "风险", "分析", "用户", "数据"].includes(word);
      }) || []
    )
  );

  return candidates.slice(0, 6);
}

function getReadingMinutes(report: WeeklyReport) {
  const textLength = getReportPlainText(report).length;
  return Math.max(1, Math.ceil(textLength / 500));
}

function getReportDateLabel(report: WeeklyReport) {
  return `${report.week_start} 至 ${report.week_end}`;
}

function formatPercentValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "暂无";
  }

  return `${value.toFixed(1)}%`;
}

function formatSignedNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "暂无";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}${suffix}`;
}

function formatDeltaText(current: number | null | undefined, previous: number | null | undefined, suffix = "") {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return "暂无对比";
  }

  return formatSignedNumber(current - previous, suffix);
}

function getSnapshot(report: WeeklyReport) {
  return report.snapshot;
}

function ReportCard({
  report,
  isCompareMode,
  isSelected,
  onToggle
}: {
  report: WeeklyReport;
  isCompareMode: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const content = (
    <Card className={cn("border-0 transition active:scale-[0.99]", isSelected ? "ring-2 ring-primary" : "")}>
      <CardContent className="p-5">
        <div className="flex gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              isSelected ? "bg-primary text-white" : "bg-blue-50 text-primary"
            )}
          >
            {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary">{getReportDateLabel(report)}</p>
            <h2 className="mt-1 truncate text-base font-bold text-slate-950">{report.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
              {cleanPreviewText(report.summary || report.content)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>最近更新 {new Date(report.updated_at).toLocaleDateString("zh-CN")}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>约 {getReadingMinutes(report)} 分钟读完</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isCompareMode) {
    return (
      <button className="block w-full text-left" onClick={onToggle} type="button">
        {content}
      </button>
    );
  }

  return (
    <Link href={`/reports/${report.id}`} className="block">
      {content}
    </Link>
  );
}

function KeywordPills({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) {
    return <p className="text-sm text-slate-400">暂无明显关键词</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <span key={keyword} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary">
          {keyword}
        </span>
      ))}
    </div>
  );
}

function TagCountPills({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">本期暂无交易标签</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([tag, count]) => (
        <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary">
          {tag} · {count}
        </span>
      ))}
    </div>
  );
}

function ReportComparePanel({ reports, selectedIds }: { reports: WeeklyReport[]; selectedIds: string[] }) {
  const selectedReports = selectedIds
    .map((id) => reports.find((report) => report.id === id))
    .filter(Boolean) as WeeklyReport[];

  if (selectedReports.length < 2) {
    return (
      <Card className="border-0 bg-blue-50">
        <CardContent className="p-5">
          <p className="font-bold text-slate-950">选择两份周报进行对比</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            可以比较不同周期的复盘重点、风险关键词和内容长度，帮助你看见自己的决策变化。
          </p>
        </CardContent>
      </Card>
    );
  }

  const [latest, previous] = selectedReports;
  const latestSnapshot = getSnapshot(latest);
  const previousSnapshot = getSnapshot(previous);
  const latestKeywords = getReportKeywords(latest);
  const previousKeywords = getReportKeywords(previous);
  const sharedKeywords = latestKeywords.filter((keyword) => previousKeywords.includes(keyword));
  const newKeywords = latestKeywords.filter((keyword) => !previousKeywords.includes(keyword));
  const hasStructuredSnapshot = Boolean(latestSnapshot && previousSnapshot);
  const metricRows =
    latestSnapshot && previousSnapshot
      ? [
          {
            label: "本周交易",
            current: `${latestSnapshot.weeklyTradeCount} 笔`,
            previous: `${previousSnapshot.weeklyTradeCount} 笔`,
            delta: formatDeltaText(latestSnapshot.weeklyTradeCount, previousSnapshot.weeklyTradeCount, " 笔")
          },
          {
            label: "当前持仓",
            current: `${latestSnapshot.currentPositionCount} 只`,
            previous: `${previousSnapshot.currentPositionCount} 只`,
            delta: formatDeltaText(latestSnapshot.currentPositionCount, previousSnapshot.currentPositionCount, " 只")
          },
          {
            label: "总仓位",
            current: formatPercentValue(latestSnapshot.totalPositionRatio),
            previous: formatPercentValue(previousSnapshot.totalPositionRatio),
            delta: formatDeltaText(latestSnapshot.totalPositionRatio, previousSnapshot.totalPositionRatio, "%")
          },
          {
            label: "最大单票仓位",
            current: formatPercentValue(latestSnapshot.maxPositionRatio),
            previous: formatPercentValue(previousSnapshot.maxPositionRatio),
            delta: formatDeltaText(latestSnapshot.maxPositionRatio, previousSnapshot.maxPositionRatio, "%")
          },
          {
            label: "估算总资产",
            current: formatAmount(latestSnapshot.estimatedTotalAssetsAtCost),
            previous: formatAmount(previousSnapshot.estimatedTotalAssetsAtCost),
            delta: formatAmount(
              latestSnapshot.estimatedTotalAssetsAtCost !== null && previousSnapshot.estimatedTotalAssetsAtCost !== null
                ? latestSnapshot.estimatedTotalAssetsAtCost - previousSnapshot.estimatedTotalAssetsAtCost
                : null
            )
          },
          {
            label: "估算已实现收益",
            current: formatAmount(latestSnapshot.estimatedRealizedProfit),
            previous: formatAmount(previousSnapshot.estimatedRealizedProfit),
            delta: formatAmount(
              latestSnapshot.estimatedRealizedProfit !== null && previousSnapshot.estimatedRealizedProfit !== null
                ? latestSnapshot.estimatedRealizedProfit - previousSnapshot.estimatedRealizedProfit
                : null
            )
          }
        ]
      : [];

  return (
    <Card className="overflow-hidden border-0">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            <GitCompare className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-950">周报对比</p>
            <p className="mt-1 text-sm text-slate-500">从复盘内容里提取重点变化</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[latest, previous].map((report, index) => (
            <div key={report.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-primary">{index === 0 ? "当前选择" : "对比对象"}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-950">{getReportDateLabel(report)}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                约 {getReadingMinutes(report)} 分钟
              </div>
            </div>
          ))}
        </div>

        {hasStructuredSnapshot ? (
          <>
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-2 text-xs font-semibold text-slate-400">
                <span>指标</span>
                <span className="text-right">本期</span>
                <span className="text-right">对比期</span>
                <span className="text-right">变化</span>
              </div>
              {metricRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-2 py-2 text-sm">
                  <span className="font-semibold text-slate-950">{row.label}</span>
                  <span className="text-right text-slate-700">{row.current}</span>
                  <span className="text-right text-slate-500">{row.previous}</span>
                  <span className="text-right font-bold text-primary">{row.delta}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-semibold text-primary">计划执行</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{latestSnapshot?.planFollowedCount || 0}</p>
                <p className="mt-1 text-xs text-slate-500">
                  偏离 {latestSnapshot?.planNotFollowedCount || 0} 次
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-semibold text-primary">闭环复盘</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{latestSnapshot?.exitReviewCount || 0}</p>
                <p className="mt-1 text-xs text-slate-500">经验记录 {latestSnapshot?.lessonCount || 0} 条</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">本期交易标签</p>
              <div className="mt-3">
                <TagCountPills counts={latestSnapshot?.weeklyTagCounts || {}} />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">本期主要持仓</p>
              <div className="mt-3 space-y-2">
                {latestSnapshot?.topPositions.length ? (
                  latestSnapshot.topPositions.map((position) => (
                    <div key={`${position.market}-${position.stockCode}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold text-slate-700">
                        {position.stockName} · {position.market}
                      </span>
                      <span className="shrink-0 font-bold text-primary">{formatPercentValue(position.positionRatio)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">暂无持仓</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm font-bold text-slate-950">旧周报暂无结构化快照</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              新生成的周报会自动保存交易数、仓位、资产、执行情况等指标；旧周报先使用文本关键词对比。
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-950">共同关注</p>
          <div className="mt-3">
            <KeywordPills keywords={sharedKeywords} />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-950">本期新增重点</p>
          <div className="mt-3">
            <KeywordPills keywords={newKeywords.length > 0 ? newKeywords : latestKeywords} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {selectedReports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Button className="w-full" variant="secondary">
                查看详情
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pageState, setPageState] = useState<"ready" | "anonymous" | "unconfigured">("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadReports() {
      try {
        const weeklyReports = await listWeeklyReports();
        setReports(weeklyReports);
        setSelectedReportIds(weeklyReports.slice(0, 2).map((report) => report.id));
        setPageState("ready");
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          setPageState("unconfigured");
        } else if (error instanceof AuthRequiredError) {
          setPageState("anonymous");
        } else {
          setErrorMessage(error instanceof Error ? error.message : "AI 周报读取失败");
        }
      } finally {
        setIsLoaded(true);
      }
    }

    void loadReports();
  }, []);

  function toggleReportSelection(reportId: string) {
    setSelectedReportIds((currentIds) => {
      if (currentIds.includes(reportId)) {
        return currentIds.filter((id) => id !== reportId);
      }

      return [reportId, ...currentIds].slice(0, 2);
    });
  }

  const latestSnapshot = reports[0]?.snapshot;

  if (!isLoaded) {
    return (
      <AppShell className="pb-8">
        <div className="px-5 py-8 text-sm text-slate-500">正在读取历史周报...</div>
      </AppShell>
    );
  }

  if (pageState === "unconfigured") {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <ConfigNotice />
        </section>
      </AppShell>
    );
  }

  if (pageState === "anonymous") {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <AuthNotice />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell className="pb-8">
      <header className="px-5 pb-4 pt-5">
        <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">已保存的复盘</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">AI 周报历史</h1>
          </div>
        </div>
      </header>

      <section className="space-y-4 px-5">
        {errorMessage ? (
          <Card className="border-0">
            <CardContent className="p-5 text-sm text-red-500">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {reports.length > 0 ? (
          <>
            <Card className="border-0 bg-slate-950 text-white">
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-2xl font-bold">{latestSnapshot?.weeklyTradeCount ?? reports.length}</p>
                    <p className="mt-1 text-xs text-slate-300">{latestSnapshot ? "本周交易" : "历史周报"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-2xl font-bold">
                      {latestSnapshot?.currentPositionCount ?? reports.slice(0, 4).reduce((sum, report) => sum + getReadingMinutes(report), 0)}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">{latestSnapshot ? "当前持仓" : "近四期分钟"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-2xl font-bold">
                      {latestSnapshot ? formatPercentValue(latestSnapshot.totalPositionRatio) : getReportKeywords(reports[0]).length}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">{latestSnapshot ? "总仓位" : "本期重点"}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-3">
                  <CalendarDays className="h-4 w-4 shrink-0 text-blue-100" />
                  <p className="text-sm leading-6 text-slate-200">最新周报：{getReportDateLabel(reports[0])}</p>
                </div>
              </CardContent>
            </Card>

            {reports.length > 1 ? (
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  className={cn(
                    "h-10 rounded-xl text-sm font-bold transition",
                    !isCompareMode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                  )}
                  onClick={() => setIsCompareMode(false)}
                  type="button"
                >
                  历史列表
                </button>
                <button
                  className={cn(
                    "h-10 rounded-xl text-sm font-bold transition",
                    isCompareMode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                  )}
                  onClick={() => setIsCompareMode(true)}
                  type="button"
                >
                  选择对比
                </button>
              </div>
            ) : null}

            {isCompareMode ? <ReportComparePanel reports={reports} selectedIds={selectedReportIds} /> : null}

            <div className="space-y-3">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isCompareMode={isCompareMode}
                  isSelected={selectedReportIds.includes(report.id)}
                  onToggle={() => toggleReportSelection(report.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <Card className="border-0">
            <CardContent className="p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
                <FileText className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-950">还没有保存的周报</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">生成一次 AI 周报后，会自动保存在这里。</p>
              <Link href="/" className="mt-5 block">
                <Button className="w-full">返回首页生成</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
