import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Instrument_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { pwaSplashStartupImages } from "@/lib/pwa-splash-startup.generated";

const themeScript = `
(function() {
  var theme = localStorage.getItem('theme');
  var preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = theme === 'dark' || (theme !== 'light' && preferDark);
  document.documentElement.classList.toggle('dark', dark);
})();
`;

const instrumentSans = Instrument_Sans({
  variable: "--font-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1c1917" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export const metadata: Metadata = {
  title: "UPG Monitor",
  description: "UPG Monitor — Multi-user uptime monitoring",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UPG Monitor",
    startupImage: pwaSplashStartupImages,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
