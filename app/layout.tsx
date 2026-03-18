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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cash Flow Ledger",
  description: "Track expenses and payments",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ledger",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-20`}
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
