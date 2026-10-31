import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "모두의 설명회", template: "%s · 모두의 설명회" },
  description: "누구나 함께 듣고 이해하는 모두의 설명회.",
};
export const viewport: Viewport = { themeColor: "#F6F7F4", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
