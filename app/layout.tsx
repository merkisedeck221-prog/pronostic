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

// Utilisée seulement dans quelques tableaux admin : pas de préchargement sur chaque page.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
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
        <a
          href="#contenu"
          className="sr-only z-50 rounded-lg bg-pronex-night px-4 py-2 text-sm font-semibold text-white ring-2 ring-pronex-pink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
        >
          Aller au contenu
        </a>
        {children}
        <Toaster position="bottom-center" mobileOffset={{ bottom: "5.5rem" }} />
      </body>
    </html>
  );
}
