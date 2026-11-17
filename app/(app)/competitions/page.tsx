import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Compétitions · Pronostics IA" };

export default function CompetitionsPage() {
  return <ComingSoon title="Compétitions" phase={5} />;
}
