import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "投资交易日志",
    short_name: "交易日志",
    description: "记录买入逻辑，周期复盘投资决策。",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0a84ff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
