import type { Metadata } from "next";
import { Manrope } from "next/font/google";
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
    <html lang="nl">
      <body className={`${manrope.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
