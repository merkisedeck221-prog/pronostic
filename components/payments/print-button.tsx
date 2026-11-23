"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Imprimer ou enregistrer en PDF (boîte de dialogue du navigateur). */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon />
      Imprimer ou enregistrer en PDF
    </Button>
  );
}
