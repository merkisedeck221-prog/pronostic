import type { Metadata } from "next";
import type { ReactNode } from "react";
import { KeyRoundIcon, LogOutIcon, MonitorSmartphoneIcon, ShieldAlertIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/password-forms";
import { ProfileForm } from "@/components/auth/profile-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { signOutAction, signOutEverywhereAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Profil · PRONEX" };

const SECTIONS = [
  { id: "informations", label: "Informations" },
  { id: "securite", label: "Sécurité" },
  { id: "sessions", label: "Sessions" },
  { id: "compte", label: "Compte" },
] as const;

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: LucideIcon; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="scroll-mt-24 space-y-4 rounded-2xl border border-white/8 bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-pronex-violet/15 text-violet-200">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h2 id={`${id}-titre`} className="text-lg font-bold">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const { profile } = user;
  const timezone = resolveTimezone(profile.timezone);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 sm:py-8">
      <PageHeader title="Mon profil" description="Vos informations, vos préférences, la sécurité et les sessions de votre compte." />

      <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-linear-to-br from-pronex-violet/15 via-card to-card p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-pronex-violet/25 font-heading text-xl font-bold text-violet-100">
          {profile.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{profile.display_name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">Membre depuis le {formatLongDate(profile.created_at, timezone)}</p>
        </div>
      </div>

      <nav aria-label="Sections du profil" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex h-9 items-center rounded-lg bg-muted px-3.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="informations" icon={UserRoundIcon} title="Informations et préférences" description={`Adresse e-mail : ${user.email}. Le fuseau horaire sert à afficher les heures des matchs.`}>
        <ProfileForm
          defaults={{
            displayName: profile.display_name,
            country: profile.country,
            phone: profile.phone,
            timezone: profile.timezone,
          }}
        />
      </Section>

      <Section id="securite" icon={KeyRoundIcon} title="Sécurité" description="Choisissez un mot de passe d'au moins 8 caractères, différent de vos autres comptes.">
        <ChangePasswordForm />
      </Section>

      <Section id="sessions" icon={MonitorSmartphoneIcon} title="Sessions" description="Déconnectez cet appareil, ou tous vos appareils si vous pensez qu'un autre a accès à votre compte.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <LogOutIcon aria-hidden />
              Se déconnecter
            </Button>
          </form>
          <form action={signOutEverywhereAction}>
            <Button type="submit" variant="destructive" className="w-full sm:w-auto">
              Se déconnecter de tous les appareils
            </Button>
          </form>
        </div>
      </Section>

      <Section id="compte" icon={ShieldAlertIcon} title="Supprimer mon compte">
        <p className="text-sm text-muted-foreground">
          Vous pouvez demander la suppression de votre compte et de vos données personnelles (e-mail, nom d&apos;affichage, pays,
          téléphone) en écrivant au support depuis l&apos;adresse e-mail de votre compte. La demande est traitée à la main par un
          administrateur. Les crédits restants ne sont pas remboursables.
        </p>
      </Section>
    </main>
  );
}
