import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Portefeuille · Pronostics IA" };

export default function PortefeuillePage() {
  return <ComingSoon title="Portefeuille" phase={7} />;
}
