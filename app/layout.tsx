import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope } from "next/font/google";
import { TopLoadingBar } from "@/components/TopLoadingBar";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Het Trade Platform",
  description: "Leer traden via de academy van Het Trade Platform",
  icons: {
    icon: "/assets/brand/logo-icon.png",
    shortcut: "/assets/brand/logo-icon.png",
    apple: "/assets/brand/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" data-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <TopLoadingBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
