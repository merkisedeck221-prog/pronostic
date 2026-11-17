import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Recharger mon compte · Pronostics IA" };

export default function RechargerPage() {
  return <ComingSoon title="Recharger mon compte" phase={8} />;
}
