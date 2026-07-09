import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "交易日志",
  description: "移动端优先的投资交易日志 PWA",
  themeColor: "#0a84ff",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "交易日志"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
