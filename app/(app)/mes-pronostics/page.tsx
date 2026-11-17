import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Mes pronostics · Pronostics IA" };

export default function MesPronosticsPage() {
  return <ComingSoon title="Mes pronostics" phase={9} />;
}
