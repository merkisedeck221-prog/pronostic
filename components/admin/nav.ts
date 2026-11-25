import {

  ArrowLeftIcon,
  BotIcon,
  CalendarDaysIcon,
  CoinsIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SettingsIcon,
  SparklesIcon,
  TagIcon,
  TrophyIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };
export type AdminNavGroup = { title: string | null; items: readonly AdminNavItem[] };

/** Admin sidebar, grouped (13 MVP entries + payment methods and revenue). */
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  { title: null, items: [{ href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboardIcon }] },
  {
    title: "Contenu",
    items: [
      { href: "/admin/competitions", label: "Compétitions", icon: TrophyIcon },
      { href: "/admin/matchs", label: "Matchs", icon: CalendarDaysIcon },
      { href: "/admin/pronostics", label: "Pronostics", icon: SparklesIcon },
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UsersIcon },
    ],
  },
  {
    title: "Ventes",
    items: [
      { href: "/admin/tarifs", label: "Tarifs", icon: TagIcon },
      { href: "/admin/packs", label: "Packs de recharge", icon: CoinsIcon },
      { href: "/admin/paiements", label: "Moyens de paiement", icon: CreditCardIcon },
      { href: "/admin/transactions", label: "Transactions", icon: ReceiptTextIcon },
      { href: "/admin/revenus", label: "Revenus", icon: WalletIcon },
    ],
  },
  {
    title: "Système",
    items: [
      { href: "/admin/synchronisation", label: "Synchronisation", icon: RefreshCwIcon },
      { href: "/admin/ia", label: "Suivi de l'IA", icon: BotIcon },
      { href: "/admin/parametres", label: "Paramètres", icon: SettingsIcon },
      { href: "/admin/journal", label: "Journal d'audit", icon: ScrollTextIcon },
    ],
  },
];

export const ADMIN_BACK_LINK: AdminNavItem = { href: "/tableau-de-bord", label: "Retour à l'application", icon: ArrowLeftIcon };

/** Flat list of every admin entry (sidebar order). */
export const ADMIN_NAV: readonly AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export function isAdminNavActive(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
