import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maintenance HQ — Управління ремонтними роботами",
    short_name: "Maintenance HQ",
    description: "Система обліку об’єктів, аварійних заявок, планування ремонтів та бюджету території",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f6f4",
    theme_color: "#176b58",
    lang: "uk",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
