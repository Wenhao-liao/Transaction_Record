"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWeeklyReport } from "@/lib/weekly-reports-api";
import { AuthRequiredError, SupabaseConfigError } from "@/lib/trades-api";
import type { WeeklyReport } from "@/lib/supabase";

type ReportSection = {
  title: string;
  lines: string[];
};

function stripMarkdownFence(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n")
    .trim();
}

function cleanDisplayText(text: string) {
  return text
    .replace(/^#+\s*/, "")
    .replace(/^\d+[.、]\s*/, "")
    .replace(/^[一二三四五六七八九十百千万]+[.、，]\s*/, "")
    .replace(/^title\s*[:：]?\s*/i, "")
    .replace(/\*\*/g, "")
    .replace(/[*_]/g, "")
    .replace(/`/g, "")
    .replace(/^["'](.+)["']$/, "$1")
    .trim();
}

function isChartConfigLine(line: string) {
  const cleanedLine = cleanDisplayText(line).toLowerCase();

  return ["pie", "bar", "line", "chart", "series", "data", "legend", "tooltip"].includes(cleanedLine);
}

function parseKeyValueLine(line: string) {
  const match = /^["']?(.+?)["']?\s*[:：]\s*(.+)$/.exec(cleanDisplayText(line));

  if (!match) {
    return null;
  }

  const label = cleanDisplayText(match[1]);
  const value = cleanDisplayText(match[2]).replace(/,$/, "");

  if (!label || !value) {
    return null;
  }

  return { label, value };
}

function shouldUseCompactKeyValue(value: string) {
  return value.length <= 12 && !/[，。；、,.]/.test(value);
}

function parseReportSections(markdown: string) {
  const normalizedMarkdown = stripMarkdownFence(markdown);
  const sections: ReportSection[] = [];
  let currentSection: ReportSection = {
    title: "",
    lines: []
  };

  normalizedMarkdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);

    if (headingMatch) {
      if (currentSection.lines.some(Boolean)) {
        sections.push(currentSection);
      }

      currentSection = {
        title: cleanDisplayText(headingMatch[2]),
        lines: []
      };
      return;
    }

    if (line === "---" || line.startsWith("```")) {
      return;
    }

    currentSection.lines.push(line);
  });

  if (currentSection.lines.some(Boolean) || sections.length === 0) {
    sections.push(currentSection);
  }

  return sections.filter((section) => section.title || section.lines.some(Boolean));
}

function renderInlineText(text: string) {
  const cleanedText = text.replace(/`/g, "").replace(/^>\s*/, "");
  const segments = cleanedText.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={`${segment}-${index}`} className="font-bold text-slate-950">
          {segment.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}

function cleanListText(line: string) {
  return line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function isMarkdownTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function isMarkdownTableSeparator(line: string) {
  return /^\|?[\s:|-]+\|?$/.test(line);
}

function parseTableRow(line: string) {
  return line
    .split("|")
    .map((cell) => cleanDisplayText(cell))
    .filter(Boolean);
}

function renderTable(lines: string[], keyPrefix: string) {
  const rows = lines.filter((line) => !isMarkdownTableSeparator(line)).map(parseTableRow);

  if (rows.length < 2) {
    return lines.map((line, index) => (
      <p key={`${keyPrefix}-fallback-${index}`} className="text-sm leading-7 text-slate-700">
        {renderInlineText(line.replace(/\|/g, " "))}
      </p>
    ));
  }

  const [headers, ...bodyRows] = rows;

  return bodyRows.map((row, rowIndex) => {
    const title = row[0] || `记录 ${rowIndex + 1}`;
    const details = row.slice(1);

    return (
      <div key={`${keyPrefix}-table-${rowIndex}`} className="rounded-2xl bg-slate-50 px-4 py-4">
        <p className="text-sm font-bold text-slate-950">{title}</p>
        <div className="mt-3 space-y-2">
          {details.map((cell, cellIndex) => (
            <div key={`${keyPrefix}-cell-${rowIndex}-${cellIndex}`} className="flex gap-3 text-sm leading-6">
              <span className="shrink-0 text-slate-400">{headers[cellIndex + 1] || "说明"}</span>
              <span className="min-w-0 flex-1 text-slate-700">{renderInlineText(cell)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  });
}

function renderSectionLines(lines: string[], sectionIndex: number) {
  const renderedLines = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (!line) {
      lineIndex += 1;
      continue;
    }

    if (isChartConfigLine(line)) {
      lineIndex += 1;
      continue;
    }

    if (isMarkdownTableLine(line)) {
      const tableLines = [];

      while (lineIndex < lines.length && isMarkdownTableLine(lines[lineIndex])) {
        tableLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      renderedLines.push(renderTable(tableLines, `${sectionIndex}-${lineIndex}`));
      continue;
    }

    const isListItem = /^([-*]\s+|\d+\.\s+)/.test(line);
    const keyValue = parseKeyValueLine(line);

    if (isListItem) {
      renderedLines.push(
        <div key={`${sectionIndex}-${lineIndex}`} className="flex gap-3 rounded-2xl bg-slate-50 px-3 py-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <p className="text-sm leading-6 text-slate-700">{renderInlineText(cleanListText(line))}</p>
        </div>
      );
    } else if (keyValue) {
      if (shouldUseCompactKeyValue(keyValue.value)) {
        renderedLines.push(
          <div
            key={`${sectionIndex}-${lineIndex}`}
            className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3"
          >
            <span className="min-w-0 text-sm font-medium leading-6 text-slate-700">
              {renderInlineText(keyValue.label)}
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-bold text-primary shadow-sm">
              {renderInlineText(keyValue.value)}
            </span>
          </div>
        );
      } else {
        renderedLines.push(
          <div key={`${sectionIndex}-${lineIndex}`} className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold leading-6 text-slate-950">{renderInlineText(keyValue.label)}</p>
            <p className="mt-1 break-words text-sm leading-7 text-slate-700">{renderInlineText(keyValue.value)}</p>
          </div>
        );
      }
    } else {
      renderedLines.push(
        <p key={`${sectionIndex}-${lineIndex}`} className="text-sm leading-7 text-slate-700">
          {renderInlineText(cleanDisplayText(line))}
        </p>
      );
    }

    lineIndex += 1;
  }

  return renderedLines;
}

function MarkdownReport({ content }: { content: string }) {
  const sections = parseReportSections(content);

  return (
    <div className="space-y-4">
      {sections.map((section, sectionIndex) => (
        <Card key={`${section.title}-${sectionIndex}`} className="border-0">
          <CardContent className="p-5">
            {section.title ? (
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-primary">
                  {sectionIndex + 1}
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">{section.title}</h2>
              </div>
            ) : null}

            <div className="space-y-3">
              {renderSectionLines(section.lines, sectionIndex)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function WeeklyReportPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pageState, setPageState] = useState<"ready" | "anonymous" | "unconfigured">("ready");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        setReport(await getWeeklyReport(params.id));
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

    void loadReport();
  }, [params.id]);

  if (!isLoaded) {
    return (
      <AppShell className="pb-8">
        <div className="px-5 py-8 text-sm text-slate-500">正在读取 AI 周报...</div>
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

  if (errorMessage) {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <Card className="border-0">
            <CardContent className="p-5 text-sm text-red-500">{errorMessage}</CardContent>
          </Card>
        </section>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell className="pb-8">
        <section className="px-5 py-8">
          <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Card className="border-0">
            <CardContent className="p-6 text-center">
              <h1 className="text-xl font-bold text-slate-950">没有找到这份 AI 周报</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">这份周报可能不存在，或者你没有访问权限。</p>
              <Link href="/" className="mt-5 block">
                <Button className="w-full">返回首页</Button>
              </Link>
            </CardContent>
          </Card>
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
            <p className="text-sm font-semibold text-primary">
              {report.week_start} 至 {report.week_end}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">AI 周报</h1>
          </div>
        </div>
      </header>

      <section className="space-y-4 px-5">
        <Card className="overflow-hidden border-0 bg-primary text-white">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-blue-100">本周摘要</p>
            <p className="mt-2 text-lg font-bold">{cleanDisplayText(stripMarkdownFence(report.title))}</p>
            <p className="mt-2 text-sm leading-6 text-blue-50">{cleanDisplayText(stripMarkdownFence(report.summary))}</p>
          </CardContent>
        </Card>

        <MarkdownReport content={report.content} />
      </section>
    </AppShell>
  );
}
