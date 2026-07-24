"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register" | "forgot";

function formatAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("email rate limit")) {
    return "登录邮件发送过于频繁，请稍后再试。";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "邮箱或密码不正确，或邮箱尚未完成确认。";
  }

  if (normalizedMessage.includes("password")) {
    return "密码格式不符合要求，请至少输入 6 位。";
  }

  if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already exists")) {
    return "这个邮箱已经注册过，请直接登录。";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handlePasswordAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage("Supabase 尚未配置，请先设置环境变量。");
      return;
    }

    if (password.length < 6) {
      setMessage("密码至少需要 6 位。");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email,
            password
          })
        : await supabase.auth.signUp({
            email,
            password
          });

    setIsLoading(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    if (mode === "register" && !data.session) {
      setMessage("注册成功，请先打开邮箱完成确认，然后再回来登录。");
      return;
    }

    router.push("/");
  }

  async function handleSendResetEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage("Supabase 尚未配置，请先设置环境变量。");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    setIsLoading(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    setMessage("重置密码邮件已发送，请打开邮箱里的链接设置新密码。");
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
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              邮箱登录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {[
                { label: "登录", value: "login" },
                { label: "注册", value: "register" }
              ].map((item) => {
                const isActive = mode === item.value;

                return (
                  <button
                    className={cn(
                      "h-10 rounded-xl text-sm font-bold transition",
                      isActive ? "bg-white text-primary shadow-sm" : "text-slate-500"
                    )}
                    key={item.value}
                    onClick={() => {
                      handleModeChange(item.value as AuthMode);
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <form className="space-y-4" onSubmit={mode === "forgot" ? handleSendResetEmail : handlePasswordAuth}>
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

              {mode !== "forgot" ? (
                <div className="space-y-2">
                  <Label>密码</Label>
                  <Input
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 6 位密码"
                    required
                    type="password"
                    value={password}
                  />
                </div>
              ) : null}

              {mode === "register" ? (
                <div className="space-y-2">
                  <Label>确认密码</Label>
                  <Input
                    autoComplete="new-password"
                    minLength={6}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入密码"
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              ) : null}

              <p className="text-xs leading-5 text-slate-500">
                {mode === "login"
                  ? "使用注册邮箱和密码登录，你的交易记录会同步保存到云端。"
                  : mode === "register"
                    ? "注册后邮箱会绑定为你的账号，用于登录和接收重要通知。"
                    : "如果这个邮箱已经注册，我们会发送一封重置密码邮件。"}
              </p>

              <Button className="w-full" disabled={isLoading} type="submit">
                {isLoading ? "处理中..." : mode === "login" ? "登录" : mode === "register" ? "注册账号" : "发送重置邮件"}
              </Button>
            </form>
            <button
              className="mt-4 w-full text-center text-sm font-semibold text-primary"
              onClick={() => handleModeChange(mode === "forgot" ? "login" : "forgot")}
              type="button"
            >
              {mode === "forgot" ? "返回登录" : "忘记密码？"}
            </button>
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
