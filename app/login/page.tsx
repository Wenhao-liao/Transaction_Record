"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Smartphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type LoginMode = "phone" | "email";

function formatAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("email rate limit")) {
    return "登录邮件发送过于频繁，请稍后再试。";
  }

  if (normalizedMessage.includes("sms") && normalizedMessage.includes("rate")) {
    return "短信验证码发送过于频繁，请稍后再试。";
  }

  if (normalizedMessage.includes("invalid") && normalizedMessage.includes("token")) {
    return "验证码不正确或已过期，请重新输入。";
  }

  if (normalizedMessage.includes("phone")) {
    return "手机号格式不正确，请使用国际格式，例如 +8613800138000。";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [countdown]);

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage("Supabase 尚未配置，请先设置环境变量。");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    setIsLoading(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    setCountdown(60);
    setMessage("登录链接已发送，请打开邮箱完成登录。");
  }

  async function handleSendPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage("Supabase 尚未配置，请先设置环境变量。");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      phone
    });

    setIsLoading(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    setCountdown(60);
    setMessage("短信验证码已发送，请在 60 秒内输入。");
  }

  async function handleVerifyPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!phone || !code) {
      setMessage("请填写手机号和验证码。");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms"
    });

    setIsLoading(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    router.push("/");
  }

  return (
    <AppShell className="pb-8">
      <section className="px-5 pt-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">登录交易日志</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          使用邮箱登录后，你的交易记录会保存到云端数据库，并受 Supabase RLS 权限保护。
        </p>

        <Card className="mt-6 border-0">
          <CardHeader>
            <CardTitle>验证码登录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {[
                { icon: Smartphone, label: "手机号", value: "phone" },
                { icon: Mail, label: "邮箱", value: "email" }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = mode === item.value;

                return (
                  <button
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
                      isActive ? "bg-white text-primary shadow-sm" : "text-slate-500"
                    )}
                    key={item.value}
                    onClick={() => {
                      setMode(item.value as LoginMode);
                      setMessage("");
                    }}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {mode === "phone" ? (
              <div className="space-y-4">
                <form className="space-y-4" onSubmit={handleSendPhoneCode}>
                  <div className="space-y-2">
                    <Label>手机号</Label>
                    <Input
                      autoComplete="tel"
                      inputMode="tel"
                      onChange={(event) => setPhone(event.target.value.trim())}
                      placeholder="+8613800138000"
                      required
                      type="tel"
                      value={phone}
                    />
                    <p className="text-xs leading-5 text-slate-500">
                      请使用国际格式，例如中国大陆手机号写成 +86 开头。
                    </p>
                  </div>
                  <Button className="w-full" disabled={isLoading || countdown > 0} type="submit">
                    {countdown > 0 ? `${countdown} 秒后可重发` : isLoading ? "发送中..." : "发送短信验证码"}
                  </Button>
                </form>

                <form className="space-y-4" onSubmit={handleVerifyPhoneCode}>
                  <div className="space-y-2">
                    <Label>验证码</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6 位验证码"
                      required
                      value={code}
                    />
                  </div>
                  <Button className="w-full" disabled={isLoading || code.length < 6} type="submit">
                    {isLoading ? "验证中..." : "验证并登录"}
                  </Button>
                </form>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleEmailLogin}>
                <div className="space-y-2">
                  <Label>邮箱</Label>
                  <Input
                    autoComplete="email"
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <Button className="w-full" disabled={isLoading || countdown > 0} type="submit">
                  {countdown > 0 ? `${countdown} 秒后可重发` : isLoading ? "发送中..." : "发送登录链接"}
                </Button>
              </form>
            )}
            {message ? <p className="mt-4 text-sm leading-6 text-slate-500">{message}</p> : null}
            <Button className="mt-3 w-full" onClick={() => router.push("/")} type="button" variant="ghost">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
