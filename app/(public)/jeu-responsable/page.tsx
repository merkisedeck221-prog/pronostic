import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Jeu responsable · PRONEX" };

// Texte provisoire (section 4). Liens d'aide à compléter avec des ressources locales.
export default function ResponsibleGamingPage() {
  return (
    <LegalPage title="Jeu responsable" updatedAt="17 novembre 2026">
      <section>
        <h2>Des analyses, pas des certitudes</h2>
        <p>
          Nos pronostics sont des estimations produites par une intelligence artificielle. Même un pronostic à forte
          probabilité peut être perdu. PRONEX ne prend aucun pari et ne verse aucun gain.
        </p>
      </section>

      <section>
        <h2>Si vous pariez ailleurs</h2>
        <ul>
          <li>Ne misez que de l&apos;argent que vous pouvez vous permettre de perdre.</li>
          <li>Fixez-vous un budget et une durée à l&apos;avance, et respectez-les.</li>
          <li>Ne cherchez jamais à « vous refaire » après une perte.</li>
          <li>Ne pariez pas sous le coup de l&apos;émotion, de l&apos;alcool ou de la fatigue.</li>
          <li>Le pari ne doit jamais être une source de revenus ni un moyen de régler des dettes.</li>
        </ul>
      </section>

      <section>
        <h2>Signes d&apos;alerte</h2>
        <ul>
          <li>Vous pariez plus que prévu ou de plus en plus souvent.</li>
          <li>Vous empruntez ou cachez vos paris à vos proches.</li>
          <li>Le jeu vous cause du stress, de l&apos;anxiété ou des problèmes d&apos;argent.</li>
        </ul>
      </section>

      <section>
        <h2>Trouver de l&apos;aide</h2>
        <p>Parler tôt aide. Vous pouvez vous adresser à un professionnel de santé ou à ces ressources :</p>
        <ul>
          <li>
            Joueurs anonymes (Gamblers Anonymous), groupes d&apos;entraide :{" "}
            <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              gamblersanonymous.org
            </a>
          </li>
          <li>
            Joueurs Info Service (France), information et aide à distance :{" "}
            <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              joueurs-info-service.fr
            </a>
          </li>
          <li>
            BeGambleAware (Royaume-Uni), conseils et outils en anglais :{" "}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              begambleaware.org
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>Mineurs</h2>
        <p>Le service est strictement réservé aux personnes de 18 ans et plus.</p>
      </section>
    </LegalPage>
  );
}
