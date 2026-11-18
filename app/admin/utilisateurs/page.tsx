import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, FilterBar, FilterInput, FilterSelect, Pagination, SortLink } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_PAGE_SIZE, pageCount, parseEnumParam, parsePageParam, parseTextParam } from "@/lib/admin/params";
import { adminRpc, type AdminUserRow } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatNumericDate, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Utilisateurs · Administration" };
const PATH = "/admin/utilisateurs";
const STATUSES = ["all", "active", "banned", "admin"] as const;
const SORTS = ["created_desc", "created_asc", "balance_desc", "balance_asc", "name"] as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const search = parseTextParam(params.q);
  const status = parseEnumParam(params.statut, STATUSES, "all");
  const sort = parseEnumParam(params.tri, SORTS, "created_desc");
  const page = parsePageParam(params.page);

  const result = await adminRpc<{ total: number; rows: AdminUserRow[] }>("admin_list_users", {
    p_search: search || null,
    p_status: status,
    p_sort: sort,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });

  return (
    <AdminPage title="Utilisateurs">
      <FilterBar resetHref={PATH}>
        <FilterInput name="q" label="Recherche (e-mail, nom ou identifiant)" value={search} className="min-w-64" />
        <FilterSelect
          name="statut"
          label="Statut"
          value={status}
          options={[
            { value: "all", label: "Tous" },
            { value: "active", label: "Actifs" },
            { value: "banned", label: "Suspendus" },
            { value: "admin", label: "Administrateurs" },
          ]}
        />
        <input type="hidden" name="tri" value={sort} />
      </FilterBar>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortLink path={PATH} params={params} current={sort} asc="name" desc="name">
                  Utilisateur
                </SortLink>
              </TableHead>
              <TableHead className="text-right">
                <SortLink path={PATH} params={params} current={sort} asc="balance_asc" desc="balance_desc">
                  Solde
                </SortLink>
              </TableHead>
              <TableHead>
                <SortLink path={PATH} params={params} current={sort} asc="created_asc" desc="created_desc">
                  Inscription
                </SortLink>
              </TableHead>
              <TableHead className="text-right">Déblocages</TableHead>
              <TableHead className="text-right">Recharges</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun utilisateur.
                </TableCell>
              </TableRow>
            ) : null}
            {result.rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/admin/utilisateurs/${u.id}`} className="font-medium underline-offset-4 hover:underline">
                    {u.display_name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{u.balance}</TableCell>
                <TableCell className="whitespace-nowrap">{formatNumericDate(u.created_at, tz)}</TableCell>
                <TableCell className="text-right tabular-nums">{u.unlocks}</TableCell>
                <TableCell className="text-right tabular-nums">{u.topups}</TableCell>
                <TableCell className="space-x-1">
                  {u.role === "admin" ? <Badge>Admin</Badge> : null}
                  <Badge variant={u.is_banned ? "destructive" : "outline"}>{u.is_banned ? "Suspendu" : "Actif"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination path={PATH} params={params} page={page} pageCount={pageCount(result.total)} total={result.total} />
    </AdminPage>
  );
}
