import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Conditions générales d'utilisation · Pronostics IA" };

// Texte provisoire conforme à la section 11 du cahier des charges.
export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="17 novembre 2026">
      <section>
        <h2>1. Nature du service</h2>
        <p>
          Pronostics IA propose des <strong>analyses de matchs de football</strong> produites par une intelligence
          artificielle à partir de données sportives (forme, classement, confrontations, absences). Le service vend
          l&apos;accès à ces analyses. <strong>Il ne s&apos;agit pas d&apos;un site de paris</strong> : aucune mise
          n&apos;est prise et aucun gain n&apos;est versé.
        </p>
      </section>

      <section>
        <h2>2. Absence de garantie</h2>
        <p>
          Les pronostics sont des <strong>estimations</strong> exprimées en probabilités, accompagnées d&apos;un
          indice de confiance. Ils ne constituent ni une certitude, ni un conseil financier, ni une incitation à
          parier. Aucun résultat n&apos;est garanti. Le taux de réussite réel de l&apos;IA est publié sur la page
          Performances.
        </p>
      </section>

      <section>
        <h2>3. Âge minimum</h2>
        <p>
          Le service est <strong>réservé aux personnes âgées de 18 ans ou plus</strong>. En créant un compte, vous
          déclarez avoir au moins 18 ans. La date de cette déclaration est enregistrée.
        </p>
      </section>

      <section>
        <h2>4. Crédits</h2>
        <ul>
          <li>Les crédits s&apos;achètent par packs et servent uniquement à débloquer des pronostics.</li>
          <li>Les crédits n&apos;expirent pas.</li>
          <li>Le prix en crédits est affiché avant chaque déblocage ; un pronostic débloqué n&apos;est jamais facturé deux fois.</li>
          <li>
            Les crédits ne sont <strong>ni remboursables ni convertibles en argent</strong>, sauf dans un cas : si un
            match est annulé ou reporté de plus de 48 heures, les crédits dépensés sur ce match sont automatiquement
            recrédités sur votre compte.
          </li>
          <li>Le résultat d&apos;un match ne donne jamais lieu à un remboursement.</li>
        </ul>
      </section>

      <section>
        <h2>5. Compte et suspension</h2>
        <p>
          Vous êtes responsable de la confidentialité de votre mot de passe. En cas d&apos;abus (fraude, tentative
          de contournement des paiements, revente ou diffusion publique des pronostics, création de comptes
          multiples), le compte peut être suspendu. Un compte suspendu ne peut plus accéder à l&apos;espace membre
          ni débloquer de pronostic.
        </p>
      </section>

      <section>
        <h2>6. Données personnelles</h2>
        <p>
          Nous collectons le strict minimum : adresse e-mail, nom d&apos;affichage, pays et, si vous le
          souhaitez, numéro de téléphone. Vous pouvez demander la suppression de votre compte et de vos données en
          contactant le support ; la demande est traitée manuellement.
        </p>
      </section>

      <section>
        <h2>7. Jeu responsable</h2>
        <p>
          Si vous utilisez nos analyses pour parier ailleurs, faites-le avec modération. Consultez notre page{" "}
          <Link href="/jeu-responsable" className="font-medium text-foreground underline underline-offset-4">
            Jeu responsable
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
