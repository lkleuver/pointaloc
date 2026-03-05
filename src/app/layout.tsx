import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bungee, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-game",
  weight: "400",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pointaloc",
  description: "Point in the direction of cities around the world",
  metadataBase: new URL("https://pointaloc.com"),
  openGraph: {
    title: "Pointaloc",
    description: "Point in the direction of cities around the world",
    siteName: "Pointaloc",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pointaloc",
    description: "Point in the direction of cities around the world",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} ${pressStart.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
