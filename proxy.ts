import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirect } from "@/lib/seo/canonical-host";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy Next.js 16 (ancien « middleware ») : rafraîchit la session Supabase à
 * chaque requête de page. La protection des pages reste dans les mises en page.
 */
export async function proxy(request: NextRequest) {
  // Anciennes adresses Vercel → https://pronex.vercel.app (sauf /api, voir lib/seo/canonical-host.ts)
  const target = canonicalRedirect(request.headers.get("host"), request.nextUrl.pathname, request.nextUrl.search);
  if (target) return NextResponse.redirect(target, 308);
  return updateSession(request);
}

export const config = {
  matcher: [
    // Toutes les routes sauf les fichiers statiques, les images et les fichiers publics.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
