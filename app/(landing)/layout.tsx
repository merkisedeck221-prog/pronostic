import { Inter_Tight } from "next/font/google";

/** Police de la landing (titres et textes), libre de droits. */
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter-tight" });

/**
 * Landing PRONEX : mise en page propre (menu et pied de page intégrés à la page),
 * sans l'en-tête ni le pied de page des autres pages publiques.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${interTight.variable} flex flex-1 flex-col`}>{children}</div>;
}
