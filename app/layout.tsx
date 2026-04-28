import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "../public/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../public/fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Quest Hall",
  description: "Quest Hall — Your adventure awaits.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Match the mobile browser chrome (address bar, notification bar on
  // Android, status bar on iOS PWA) to the body background so the site
  // doesn't look like it's sitting inside a default-white shell.
  themeColor: '#0b0d11',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b0d11] text-white`}>
        {children}
      </body>
    </html>
  );
}
