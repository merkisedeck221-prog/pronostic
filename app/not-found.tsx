import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen, statusPrimaryCta, statusSecondaryCta } from "@/components/layout/status-screen";

export const metadata: Metadata = { title: "Page introuvable · PRONEX" };

/** 404 en français (pages inexistantes, matchs non publiés, accès admin refusé). */
export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="Page introuvable"
      actions={
        <>
          <Link href="/" className={statusPrimaryCta}>
            Retour à l&apos;accueil
          </Link>
          <Link href="/matchs" className={statusSecondaryCta}>
            Voir les matchs
          </Link>
        </>
      }
    >
      <p>Cette page n&apos;existe pas ou n&apos;est plus disponible.</p>
    </StatusScreen>
  );
}
