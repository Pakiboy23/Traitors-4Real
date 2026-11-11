import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../fonts/faces.css";
import "../index.css";

/* Latin files only. The stylesheet still serves every subset; these are the
   faces next/font preloaded when subsets was ["latin"]. */
const latinFontPreloads = [
  "/fonts/fraunces-latin.woff2",
  "/fonts/ibm-plex-sans-latin.woff2",
  "/fonts/ibm-plex-mono-latin-500.woff2",
  "/fonts/ibm-plex-mono-latin-600.woff2",
  "/fonts/ibm-plex-mono-latin-700.woff2",
  "/fonts/manrope-latin.woff2",
];

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
    <html lang="en">
      <head>
        {latinFontPreloads.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
