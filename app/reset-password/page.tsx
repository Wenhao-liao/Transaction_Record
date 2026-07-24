"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfigNotice } from "@/components/auth-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function formatAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("expired")) {
    return "重置链接已过期，请重新发送重置密码邮件。";
  }

  if (normalizedMessage.includes("password")) {
    return "密码格式不符合要求，请至少输入 6 位。";
  }

  return message;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pageState, setPageState] = useState<"checking" | "ready" | "invalid" | "unconfigured">(
    isSupabaseConfigured ? "checking" : "unconfigured"
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    async function prepareRecoverySession() {
      try {
        const code = new URLSearchParams(window.location.search).get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        }

        const { data } = await supabase.auth.getSession();

        if (data.session) {
          setPageState("ready");
        } else {
          setPageState("invalid");
        }
      } catch (error) {
        setPageState("invalid");
        setMessage(error instanceof Error ? formatAuthError(error.message) : "重置链接无效，请重新发送邮件。");
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setPageState("ready");
      }
    });

    void prepareRecoverySession();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 6) {
      setMessage("密码至少需要 6 位。");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("两次输入的新密码不一致。");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password
    });

    setIsSaving(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    setMessage("密码已更新，正在进入首页。");
    router.push("/");
  }

  return (
    <AppShell className="pb-8">
      <section className="px-5 pt-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">重置密码</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          为你的交易日志账号设置一个新密码，之后就可以用邮箱和密码登录。
        </p>

        {pageState === "unconfigured" ? (
          <div className="mt-6">
            <ConfigNotice />
          </div>
        ) : null}

        {pageState === "checking" ? <p className="mt-6 text-sm text-slate-500">正在校验重置链接...</p> : null}

        {pageState === "invalid" ? (
          <Card className="mt-6 border-0">
            <CardContent className="px-6 py-8 text-center">
              <h2 className="text-lg font-bold text-slate-950">链接不可用</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {message || "这个重置链接可能已过期，请回到登录页重新发送重置密码邮件。"}
              </p>
              <Link href="/login" className="mt-5 block">
                <Button className="w-full">返回登录</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {pageState === "ready" ? (
          <Card className="mt-6 border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-primary" />
                设置新密码
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleUpdatePassword}>
                <div className="space-y-2">
                  <Label>新密码</Label>
                  <Input
                    autoComplete="new-password"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 6 位密码"
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <div className="space-y-2">
                  <Label>确认新密码</Label>
                  <Input
                    autoComplete="new-password"
                    minLength={6}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入新密码"
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>
                <Button className="w-full" disabled={isSaving} type="submit">
                  {isSaving ? "保存中..." : "保存新密码"}
                </Button>
              </form>
              {message ? <p className="mt-4 text-sm leading-6 text-slate-500">{message}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
