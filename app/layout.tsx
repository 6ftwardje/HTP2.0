import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { TopLoadingBar } from "@/components/TopLoadingBar";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const themeScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("htp-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch (_) {}
})();
`;

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
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <TopLoadingBar />
        {children}
      </body>
    </html>
  );
}
