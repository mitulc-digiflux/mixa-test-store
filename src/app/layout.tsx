import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TrackingScripts } from "@/components/tracking-scripts";
import { CartLink, ClickIdBadge } from "@/components/header-client";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "mixa Test Store",
  description: "Test storefront for the mixa CSV integration: tracking + order webhooks",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <TrackingScripts />

      </head>
      <body className="min-h-dvh font-sans">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight">
              mixa Test Store
            </Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900">Shop</Link>
            <Link href="/orders" className="text-stone-600 hover:text-stone-900">Orders</Link>
            <Link href="/feed" className="text-stone-600 hover:text-stone-900">XML feed</Link>
            <Link href="/setup" className="text-stone-600 hover:text-stone-900">Setup</Link>
            <span className="ms-auto flex items-center gap-4">
              <ClickIdBadge />
              <CartLink />
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
