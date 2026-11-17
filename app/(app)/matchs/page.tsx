import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Matchs à venir · Pronostics IA" };

export default function MatchsPage() {
  return <ComingSoon title="Matchs à venir" phase={5} />;
}
