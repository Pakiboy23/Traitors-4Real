import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "../index.css";

/* Downloaded at build time and served from this app. Weights are the ones the
   UI requests: Fraunces 500–800, IBM Plex Sans 400–700, IBM Plex Mono 500–700,
   Manrope 400–800. */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-fraunces",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-plex-mono",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

const fontVariables = [
  fraunces.variable,
  plexSans.variable,
  plexMono.variable,
  manrope.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Round Table Draft",
  description: "Fantasy draft and weekly scoring for a private reality-TV league.",
  applicationName: "Round Table Draft",
  manifest: "/manifest.webmanifest",
  // Generated from design/app-icon.svg by scripts/build-icons.mjs.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Round Table Draft",
    // The app is dark, so a light status bar over it would be unreadable.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0d1118",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
