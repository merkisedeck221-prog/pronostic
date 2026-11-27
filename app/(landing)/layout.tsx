/**
 * Landing PRONEX : mise en page propre (menu et pied de page intégrés à la page),
 * sans l'en-tête ni le pied de page des autres pages publiques. Police Inter Tight
 * chargée dans app/layout.tsx.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
