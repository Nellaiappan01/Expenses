import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "./components/AppHeader";
import MainWithPadding from "./components/MainWithPadding";
import Navbar from "./components/Navbar";
import PwaProvider from "./components/PwaProvider";
import RequireUser from "./components/RequireUser";
import { ConfigProvider } from "./context/ConfigContext";
import { UserProvider } from "./context/UserContext";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/brandAssets";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Site expense entry, wallet tracking and Google Sheets sync",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_SHORT_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B4A8C",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light only" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[var(--background)] text-[var(--foreground)] antialiased pb-28`}
      >
        <UserProvider>
          <ConfigProvider>
          <RequireUser>
            <PwaProvider>
              <AppHeader />
              <MainWithPadding>{children}</MainWithPadding>
              <Navbar />
            </PwaProvider>
          </RequireUser>
          </ConfigProvider>
        </UserProvider>
      </body>
    </html>
  );
}
