/** Les 13 entrées de la barre latérale d'administration. */
export const ADMIN_NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/competitions", label: "Compétitions" },
  { href: "/admin/matchs", label: "Matchs" },
  { href: "/admin/pronostics", label: "Pronostics" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/tarifs", label: "Tarifs" },
  { href: "/admin/packs", label: "Packs de recharge" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/synchronisation", label: "Synchronisation" },
  { href: "/admin/ia", label: "Suivi de l'IA" },
  { href: "/admin/parametres", label: "Paramètres" },
  { href: "/admin/journal", label: "Journal d'audit" },
  { href: "/tableau-de-bord", label: "Retour à l'application" },
] as const;
