"use client";

import { useEffect } from "react";

/**
 * Applique le design PRONEX (classe `pxa-body`) au <body> tant que la page est
 * affichée : les fenêtres, menus et feuilles rendus hors de la page (portails)
 * reçoivent ainsi les mêmes couleurs que l'espace utilisateur.
 */
export function DesignScope() {
  useEffect(() => {
    document.body.classList.add("pxa-body");
    return () => document.body.classList.remove("pxa-body");
  }, []);
  return null;
}
