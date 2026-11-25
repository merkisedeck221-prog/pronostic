import type { Metadata, Viewport } from "next";
import { Exo_2, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

/** Police des titres PRONEX (sportive, proche du logo). */
const exo2 = Exo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "PRONEX — Prédisez. Analysez. Dominez.", template: "%s" },
  description:
    "PRONEX : analyses et pronostics football par intelligence artificielle, débloqués avec des crédits.",
  applicationName: "PRONEX",
};

export const viewport: Viewport = {
  themeColor: "#080b20",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${exo2.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
