import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Card Benefits Tracker",
  description: "Build and manage your card benefits lineup",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} text-white antialiased`}
      >
        <div className="min-h-screen bg-[radial-gradient(120%_78%_at_50%_-14%,rgba(127,182,255,0.2),transparent_56%),radial-gradient(86%_64%_at_92%_42%,rgba(247,201,72,0.12),transparent_58%),linear-gradient(180deg,#0B1220_0%,#0B1220_58%,#0A111D_100%)]">
          <AppHeader />
          <main className="pt-16">{children}</main>
        </div>
      </body>
    </html>
  );
}
