import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { ADMIN_TIMEZONE } from "./datetime";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Période de la page Revenus (?du=AAAA-MM-JJ&au=AAAA-MM-JJ), en jours de
 * Porto-Novo. Par défaut : du 1er du mois en cours à aujourd'hui. Une période
 * inversée est remise dans l'ordre ; 2 ans au plus (limite de la fonction SQL).
 */
export function parseRevenuePeriod(params: { du?: unknown; au?: unknown }, now = new Date()): { from: string; to: string } {
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const today = formatInTimeZone(now, ADMIN_TIMEZONE, "yyyy-MM-dd");
  const monthStart = `${today.slice(0, 8)}01`;
  const rawFrom = pick(params.du);
  const rawTo = pick(params.au);
  let from = typeof rawFrom === "string" && isRealDay(rawFrom) ? rawFrom : monthStart;
  let to = typeof rawTo === "string" && isRealDay(rawTo) ? rawTo : today;
  if (to < from) [from, to] = [to, from];
  const maxSpanMs = 731 * 86_400_000;
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > maxSpanMs) {
    from = new Date(Date.parse(`${to}T00:00:00Z`) - maxSpanMs).toISOString().slice(0, 10);
  }
  return { from, to };
}

const row = z.object({ revenue_xof: z.number(), topups: z.number() });

export const revenueSchema = z.object({
  ok: z.literal(true),
  revenue_xof: z.number(),
  topups: z.number(),
  buyers: z.number(),
  credits_sold: z.number(),
  credits_bonus: z.number(),
  credits_promo: z.number(),
  credits_consumed: z.number(),
  credits_refunded: z.number(),
  failed_topups: z.number(),
  by_day: z.array(row.extend({ day: z.string() })),
  by_pack: z.array(row.extend({ pack_name: z.string() })),
  by_provider: z.array(row.extend({ provider: z.string() })),
  by_promo: z.array(z.object({ code: z.string(), topups: z.number(), credits: z.number() })),
});

export type Revenue = z.infer<typeof revenueSchema>;
