import type { Metadata, Viewport } from "next";
import { Hahmlet } from "next/font/google";
import "./globals.css";

const hahmlet = Hahmlet({ subsets: ["latin"], weight: "100", variable: "--font-brand" });

export const metadata: Metadata = {
  title: { default: "이 회의 통역 되나요?", template: "%s · 이 회의 통역 되나요?" },
  description: "누구나 함께 듣고 이해하는 이 회의 통역 되나요?",
};
export const viewport: Viewport = { themeColor: "#F6F7F4", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className={hahmlet.variable}>{children}</body></html>;
}
