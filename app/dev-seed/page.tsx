"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function DevSeedPage() {
  const [message, setMessage] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);

  async function seedData() {
    setIsSeeding(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setMessage("请先登录后再生成测试数据。");
        return;
      }

      const response = await fetch("/api/dev-seed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const result = (await response.json()) as {
        insertedTrades?: number;
        insertedReports?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "测试数据生成失败");
      }

      setMessage(`已生成 ${result.insertedTrades} 笔交易和 ${result.insertedReports} 份测试周报。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试数据生成失败");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <AppShell className="pb-8">
      <section className="px-5 py-5">
        <Link href="/" className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Card className="border-0">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold text-primary">开发工具</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">生成测试数据</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                会插入 A股、港股、美股、做T、清仓、标签、行业和周报对比测试数据。只会清理之前的 seed 测试数据。
              </p>
            </div>
            <Button className="w-full" disabled={isSeeding} onClick={() => void seedData()}>
              {isSeeding ? "生成中..." : "生成完整测试数据"}
            </Button>
            {message ? <p className="text-sm leading-6 text-slate-500">{message}</p> : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
