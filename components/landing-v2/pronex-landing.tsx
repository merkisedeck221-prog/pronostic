"use client";

import "./landing.css";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { PronexMark } from "@/components/layout/pronex-mark";
import { MARKET_CARDS } from "@/components/landing/markets";
import type { LandingData } from "@/lib/catalog/landing";

/**
 * Landing PRONEX (refonte validée par le porteur le 27/11/2026) : mise en page,
 * couleurs, composants et animations du modèle étudié, contenus PRONEX réels.
 * - Packs et prix lus en base (LandingData) : jamais de valeur inventée.
 * - Aucun témoignage, avis, réseau social ou statistique fictifs.
 * - Visuels : fonds « terrain » en attendant les photos libres de droits.
 * Styles : ./landing.css, limités à `.pxl`.
 */

type Props = {
  marketCodes: string[];
  packs: LandingData["packs"];
  pricing: LandingData["pricing"];
  competitions: LandingData["competitions"];
};

const ARROW = (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" />
  </svg>
);
const LEFT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#000" strokeWidth="1.6" aria-hidden>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </svg>
);
const RIGHT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#000" strokeWidth="1.6" aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
const UP_RIGHT = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#000" strokeWidth="1.6" aria-hidden>
    <path d="M3.5 10.5l7-7M5 3.5h5.5V9" />
  </svg>
);

/** Symbole PRONEX (composant partagé). */
function Symbol({ body, ball, accent, height }: { body: string; ball: string; accent: string; height: number }) {
  return <PronexMark className="pxsym" body={body} ball={ball} accent={accent} height={height} />;
}

/* Photos générées pour PRONEX (Higgsfield, 27/11/2026) : public/landing/v2/. */
const IMG = {
  hero: "/landing/v2/hero.webp",
  cta: "/landing/v2/cta.webp",
  sprint: "/landing/v2/sprint.webp",
  aerial: "/landing/v2/aerial.webp",
  net: "/landing/v2/net.webp",
} as const;

/** Photo de fond (remplit son parent, positionné). */
function Photo({ src, className = "bgimg", sizes = "(min-width: 1140px) 560px, 100vw", priority = false }: { src: string; className?: string; sizes?: string; priority?: boolean }) {
  return <Image src={src} alt="" fill sizes={sizes} className={className} priority={priority} />;
}

const fr = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");

/* ---------- Apparition au défilement + compteurs ---------- */
function useReveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const countUp = (el: HTMLElement) => {
      const to = Number(el.dataset.count), suffix = el.dataset.suffix ?? "";
      if (reduce) { el.textContent = fr(to) + suffix; return; }
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1600), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fr(Math.round(to * e)) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          el.classList.add("in");
          io.unobserve(el);
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
          el.querySelectorAll<HTMLElement>("[data-bars]").forEach((bars) => {
            const on = Math.round(bars.children.length * Number(bars.dataset.bars));
            [...bars.children].forEach((b, i) => setTimeout(() => b.classList.toggle("on", i < on), reduce ? 0 : 40 * i));
          });
        }),
      { threshold: 0.15 },
    );
    document.querySelectorAll(".pxl [data-a]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ---------- Carrousel infini (pas mesuré : largeur d'une carte + espace) ---------- */
function useLoop(count: number, trackRef: RefObject<HTMLDivElement | null>) {
  const [index, setIndex] = useState(count);
  const [animate, setAnimate] = useState(true);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current, first = track?.children[0] as HTMLElement | undefined;
      if (!track || !first) return;
      setStep(first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0"));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [trackRef]);
  const onEnd = useCallback(() => {
    if (index >= count * 2 || index < count) {
      setAnimate(false);
      setIndex((i) => (i >= count * 2 ? i - count : i + count));
    }
  }, [index, count]);
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, [animate]);
  return {
    index,
    style: { transform: `translateX(${-index * step}px)`, transition: animate ? undefined : "none" },
    next: () => setIndex((i) => i + 1),
    prev: () => setIndex((i) => i - 1),
    onEnd,
  };
}

const SHORT: Record<string, string> = {
  MATCH_RESULT: "1N2",
  DOUBLE_CHANCE: "1N · 12",
  HANDICAP: "±1,5",
  OVER_UNDER_1_5: "1,5",
  OVER_UNDER_2_5: "2,5",
  OVER_UNDER_3_5: "3,5",
  BTTS: "BTTS",
  EXACT_SCORE: "2-1",
  HT_RESULT: "MT",
  HT_FT: "N/1",
  CORNERS_OVER_UNDER_9_5: "9,5",
  CARDS_OVER_UNDER_4_5: "4,5",
  COMBO: "IA+",
};

const STEPS: [string, string][] = [
  ["Découvrez les matchs", "Consultez les rencontres disponibles et choisissez le match qui vous intéresse. Forme, classement et confrontations sont en accès libre."],
  ["PRONEX AI analyse", "L'intelligence artificielle étudie les statistiques et les informations disponibles, puis donne probabilités, niveau de confiance et explication."],
  ["Débloquez les pronostics", "Utilisez vos crédits pour un pronostic ou le match complet. Le prix est affiché avant chaque confirmation."],
  ["Suivez les résultats", "Retrouvez vos pronostics, leur statut et les performances. Gagné, perdu ou annulé : vérifié automatiquement après le match."],
];

/* Nom, pays et identifiant API-Football (logo de repli si la base n'en fournit pas). */
const COMPETITIONS: [string, string, number][] = [
  ["Premier League", "Angleterre", 39],
  ["LaLiga", "Espagne", 140],
  ["Serie A", "Italie", 135],
  ["Bundesliga", "Allemagne", 78],
  ["Ligue 1", "France", 61],
];

function Pill({ children }: { children: ReactNode }) {
  return <span className="pill-tag">{children}</span>;
}

/** Logo d'une compétition (API-Football, lu en base) sur pastille blanche. */
function LeagueLogo({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (!src) return null;
  return <Image src={src} alt={name} width={size} height={size} className="league-logo" />;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* Photo de fond de chaque type de pronostic (5 photos générées, en alternance). */
const MARKET_PHOTOS = [IMG.hero, IMG.sprint, IMG.aerial, IMG.net, IMG.cta];

export function PronexLanding({ marketCodes, packs, pricing, competitions }: Props) {
  const comps = COMPETITIONS.map(([name, country, apiId]) => ({
    name,
    country,
    logo: competitions.find((c) => norm(c.name) === norm(name))?.logo_url ?? `https://media.api-sports.io/football/leagues/${apiId}.png`,
  }));
  useReveal();

  const markets = MARKET_CARDS.filter((m) => marketCodes.length === 0 || marketCodes.includes(m.code));
  const marketCount = markets.length;
  const priceLine = pricing
    ? `${pricing.marketMin === pricing.marketMax ? pricing.marketMin : `${pricing.marketMin} à ${pricing.marketMax}`}`
    : null;

  /* Pronostics */
  const mkTrack = useRef<HTMLDivElement>(null);
  const mk = useLoop(markets.length, mkTrack);
  /* Compétitions */
  const coTrack = useRef<HTMLDivElement>(null);
  const co = useLoop(COMPETITIONS.length, coTrack);

  /* Étapes */
  const [step, setStep] = useState(0);

  /* Diaporama */
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % 3), 3500);
    return () => clearInterval(id);
  }, []);

  /* Engagements */
  const QUOTES = [
    `“Le prix est affiché avant chaque confirmation, avec votre solde avant et après. Les crédits sont débités une seule fois et l'analyse s'affiche aussitôt.”`,
    `“Chaque pronostic publié est vérifié automatiquement après le match. Les gagnés, les perdus et les annulés sont comptés, toujours : le taux de réussite de PRONEX AI est public.”`,
    `“Un pronostic est une estimation : il peut être perdu, même avec un niveau de confiance élevé. PRONEX ne garantit aucun gain. Réservé aux 18 ans et plus.”`,
  ];
  const [quote, setQuote] = useState(1);
  const [quoteVisible, setQuoteVisible] = useState(true);
  const quoteRef = useRef(1);
  const showQuote = useCallback((i: number) => {
    quoteRef.current = i;
    setQuoteVisible(false);
    setTimeout(() => { setQuote(i); setQuoteVisible(true); }, 400);
  }, []);
  useEffect(() => {
    const id = setInterval(() => showQuote((quoteRef.current + 1) % 3), 7000);
    return () => clearInterval(id);
  }, [showQuote]);

  /* Packs */
  const plansRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState(0);
  const planShift = () => {
    const first = plansRef.current?.children[0] as HTMLElement | undefined;
    return first ? first.offsetWidth + 19.5 : 0;
  };
  const [planOffset, setPlanOffset] = useState(0);
  const movePlan = (d: number) => {
    const visible = window.innerWidth > 1100 ? 3 : 1;
    const next = Math.max(0, Math.min(packs.length - visible, plan + d));
    setPlan(next);
    setPlanOffset(next * planShift());
  };
  const STYLES = ["dark", "light", "photo", "dark", "light"];

  /* FAQ */
  const FAQ: [string, string][] = [
    ["Qu'est-ce que PRONEX ?", "PRONEX est une plateforme de pronostics football assistés par intelligence artificielle. Pour chaque match analysé, PRONEX AI propose une sélection, une probabilité estimée, un niveau de confiance et une explication. Ce sont des estimations : elles aident à comprendre une rencontre, elles ne garantissent aucun résultat."],
    ["Comment fonctionne PRONEX AI ?", "Pour chaque match, PRONEX AI rassemble les données disponibles (forme récente, classement, confrontations directes, absences signalées, statistiques) puis analyse la rencontre une seule fois. Chaque pronostic est contrôlé automatiquement avant d'être publié."],
    ["Comment obtenir des crédits ?", `Une fois inscrit, vous achetez un pack depuis la page Recharger${packs.length ? ` (${packs.map((p) => `${p.name} : ${fr(p.price_xof)} FCFA pour ${p.credits} crédits`).join(" ; ")})` : ""}. Les crédits n'expirent pas et un reçu est disponible pour chaque achat.`],
    ["Comment débloquer un pronostic ?", `Ouvrez la fiche d'un match, choisissez un pronostic ou le match complet, puis confirmez. Le prix${pricing ? ` (${priceLine} crédits${pricing.bundle ? `, ou ${pricing.bundle} pour le match complet moins ce que vous avez déjà payé` : ""})` : ""} est affiché avant la confirmation.`],
    ["Comment sont calculées les performances ?", "Après chaque match, les pronostics sont vérifiés automatiquement à partir du score officiel au temps réglementaire : gagné, perdu ou annulé. Le taux de réussite est égal aux gagnés divisés par (gagnés + perdus) ; les pronostics perdus sont toujours publiés."],
    ["PRONEX garantit-il des gains ?", "Non. Un pronostic de PRONEX AI est une estimation fondée sur des données : il peut être perdu, même avec un niveau de confiance élevé. PRONEX ne garantit aucun gain. Réservé aux personnes de 18 ans ou plus."],
  ];
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <div className="pxl">
      {/* ================= EN-TÊTE ================= */}
      <section className="hero ph has-img">
        <Photo src={IMG.hero} className="bg" sizes="100vw" priority />
        <nav className="nav" aria-label="Navigation principale">
          <Link className="logo" href="/" aria-label="PRONEX, accueil">
            <Symbol body="#fff" ball="#c9f13e" accent="#fff" height={30} />
            <span className="pxwm">PRONEX</span>
          </Link>
          <ul>
            <li><a href="#fonctionnement">Fonctionnement</a></li>
            <li><a href="#pronostics">Pronostics</a></li>
            <li><a href="#tarifs">Tarifs</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><Link href="/connexion">Connexion</Link></li>
          </ul>
          <span className="nav-actions">
            <Link className="login-m" href="/connexion">Connexion</Link>
            <Link className="join" href="/inscription">Créer mon compte</Link>
          </span>
        </nav>
        <div className="hero-in">
          <div className="hero-avatars hero-anim">
            {comps.map((c, i) => (
              <span key={c.name} className="lg-item">
                {i > 0 ? <i /> : null}
                <span className="lg-dot"><LeagueLogo src={c.logo} name="" size={18} /></span>
                {c.name}
              </span>
            ))}
          </div>
          <p className="hero-small hero-anim d1">Prédisez. Analysez. Dominez. Des pronostics football expliqués par l&apos;intelligence artificielle.</p>
          <div className="hero-bottom">
            <h1 className="hero-anim d1">Le football analysé par l&apos;intelligence artificielle.</h1>
            <p className="lead hero-anim d2">Probabilités, niveaux de confiance et explications claires pour chaque match, avec des résultats publiés en toute transparence.</p>
            <div className="ctas hero-anim d3">
              <Link className="btn btn-lime" href="/inscription">Créer mon compte <span className="dot">{ARROW}</span></Link>
              <Link className="btn btn-white" href="/performances">Voir les performances <span className="dot">{ARROW}</span></Link>
            </div>
          </div>
        </div>
      </section>

      <main id="contenu" tabIndex={-1} style={{ outline: "none" }}>
        {/* ================= MANIFESTE + CARTES ================= */}
        <section className="manifesto" id="presentation">
          <div className="wrap">
            <h2 data-a="up56">
              Chez PRONEX, un pronostic n&apos;est pas une intuition.{" "}
              <span className="inl racket ph has-img" data-a="pop" style={{ width: 124, height: 51, borderRadius: 99, overflow: "hidden" }} aria-hidden><Photo src={IMG.net} sizes="140px" /></span>{" "}
              C&apos;est une analyse fondée sur les données, expliquée{" "}
              <span className="inl racket ph has-img" data-a="pop" style={{ width: 131, height: 51, borderRadius: 99, overflow: "hidden" }} aria-hidden><Photo src={IMG.aerial} sizes="140px" /></span>{" "}
              clairement et vérifiée après chaque match.
            </h2>

            <div className="trio">
              <div className="card people" data-a="scale">
                <p className="k">PRONEX AI</p>
                <h3>Une sélection, une probabilité et une explication pour chaque pronostic.</h3>
                <div className="team">
                  <div className="conf"><span>Faible</span><span>Moyen</span><span className="on">Élevé</span></div>
                  <span>Niveau de<br />confiance indiqué.</span>
                </div>
                <a className="about" href="#fonctionnement">FONCTIONNEMENT</a>
              </div>
              <div className="card photo-card ph has-img" data-a="scale">
                <Photo src={IMG.net} className="bg" sizes="(min-width: 1140px) 361px, 100vw" />
                <i className="shade" aria-hidden />
                <div className="chips">Analyse &nbsp;•&nbsp; Probabilités &nbsp;•&nbsp; Confiance</div>
                <div className="glass">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9f13e" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7l3 2-1 4h-4l-1-4z" /></svg>
                  <b data-count={marketCount}>0</b>
                  <span>Types de pronostics</span>
                </div>
                <p className="big">Moins d&apos;intuition.<br />Plus d&apos;analyse.</p>
              </div>
              <div className="card impact" data-a="scale">
                <p className="k">EXEMPLE D&apos;ANALYSE</p>
                <p className="pct" data-count={68} data-suffix={" %"}>0&nbsp;%</p>
                <p className="lbl">Probabilité estimée</p>
                <span className="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" aria-hidden><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg></span>
                <div className="bars" data-bars="0.68" aria-hidden>{Array.from({ length: 22 }, (_, i) => <i key={i} />)}</div>
                <div className="scale"><span>0&nbsp;%</span><span>100&nbsp;%</span></div>
                <div className="rec">
                  <span>Chaque sélection affiche sa probabilité<br />et son niveau de confiance.</span>
                  <a className="circle-arrow" href="#pronostics" aria-label="Voir les types de pronostics">{ARROW}</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="numbers" aria-label="PRONEX en quelques chiffres">
          <div className="wrap" data-a="up">
            <h3>PRONEX en quelques chiffres</h3>
            <div className="nums">
              <div><b data-count={marketCount}>0</b><span>Types de pronostics</span></div>
              <div><b data-count={5}>0</b><span>Grands championnats</span></div>
              <div><b data-count={48} data-suffix={" h"}>0&nbsp;h</b><span>Fenêtre d&apos;analyse avant le match</span></div>
              <div><b data-count={100} data-suffix={" %"}>0&nbsp;%</b><span>Des pronostics vérifiés</span></div>
            </div>
          </div>
        </section>

        {/* ================= TYPES DE PRONOSTICS ================= */}
        <section className="services" id="pronostics" aria-labelledby="pronostics-titre">
          <div className="wrap">
            <div className="svc-head" data-a="up">
              <div><Pill>PRONOSTICS</Pill><h2 className="h2" id="pronostics-titre">Tous les angles d&apos;un match.</h2></div>
              <p>Chaque match est analysé sur {marketCount} types de pronostics. Débloquez-les un par un, ou tous ensemble avec le match complet.</p>
            </div>
            <div className="svc-row" data-a="scale8">
              <div className="svc-left">
                <div className="arrows">
                  <button type="button" className="arr w" onClick={mk.prev} aria-label="Pronostic précédent">{LEFT}</button>
                  <button type="button" className="arr" onClick={mk.next} aria-label="Pronostic suivant">{RIGHT}</button>
                </div>
              </div>
              <div className="svc-viewport">
                <div className="svc-track" ref={mkTrack} style={mk.style} onTransitionEnd={mk.onEnd}>
                  {[...markets, ...markets, ...markets].map((m, i) => (
                    <article key={i} className={`svc-card mk has-img${i === mk.index ? " on" : ""}${i === mk.index + 1 ? " on2" : ""}`} aria-hidden={i < markets.length || i >= markets.length * 2}>
                      <Photo src={MARKET_PHOTOS[(i % markets.length) % MARKET_PHOTOS.length]} sizes="(min-width: 1140px) 378px, 300px" />
                      <i className="mk-shade" aria-hidden />
                      <span className="code">{SHORT[m.code] ?? m.name}</span>
                      <span className="num">{String((i % markets.length) + 1).padStart(2, "0")}&nbsp;/&nbsp;{markets.length}</span>
                      <div className="glass"><h4>{m.name}</h4><p>{m.text}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= FONCTIONNEMENT ================= */}
        <section className="steps" id="fonctionnement" aria-labelledby="fonctionnement-titre">
          <div className="wrap grid" data-a="up">
            <div>
              <Pill>Fonctionnement</Pill>
              <h2 className="h2" id="fonctionnement-titre">Du choix du match<br />au suivi des résultats.</h2>
              <div>
                {STEPS.map(([t, d], i) => (
                  <div key={t} className={`step${step === i ? " on" : ""}`} onClick={() => setStep(i)} onMouseEnter={() => setStep(i)}>
                    <button type="button" className="t" aria-expanded={step === i} onClick={() => setStep(i)}><small>0{i + 1}</small>{t}</button>
                    <div className="d"><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="step-img" aria-hidden>
              {STEPS.map(([t], i) => (
                <div key={t} className="ph has-img" style={{ position: "absolute", inset: 0, opacity: step === i ? 1 : 0, transition: "opacity .8s var(--ease)" }}><Photo src={[IMG.sprint, IMG.aerial, IMG.net, IMG.hero][i]} /></div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= POURQUOI PRONEX ================= */}
        <section className="why" aria-labelledby="pourquoi-titre">
          <div className="wrap">
            <div data-a="up"><Pill>Pourquoi PRONEX</Pill><h2 className="h2" id="pourquoi-titre">Plus qu&apos;un pronostic. Une analyse transparente.</h2></div>
            <div className="why-grid">
              <div className="slides" data-a="left" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="ph has-img" style={{ position: "absolute", inset: 0, opacity: slide === i ? 1 : 0, transition: "opacity 1s var(--ease)" }}><Photo src={[IMG.aerial, IMG.sprint, IMG.net][i]} sizes="(min-width: 1140px) 720px, 100vw" /></div>
                ))}
                <div className="dots">{[0, 1, 2].map((i) => <i key={i} className={slide === i ? "on" : ""} />)}</div>
              </div>
              <div className="why-a" data-a="down80">
                <span className="icon"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg></span>
                <b>{priceLine ?? "—"}</b>
                <span>Crédits par pronostic, prix affiché avant</span>
              </div>
              <div className="why-b" data-a="up20">
                <span className="icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20 6 9 17l-5-5" /></svg></span>
                {pricing?.bundle ? <b data-count={pricing.bundle} data-suffix={" crédits"}>0</b> : <b>Match complet</b>}
                <span>Le match complet, moins ce que vous avez déjà payé</span>
              </div>
            </div>
            <div className="why-row">
              <div className="card ph has-img" data-a="up"><Photo src={IMG.sprint} sizes="(min-width: 1140px) 318px, 100vw" /><i className="shade" aria-hidden /><h4>Sans abonnement</h4><p>Payez à l&apos;unité.</p></div>
              <div className="card wide ph has-img" data-a="right"><Photo src={IMG.aerial} sizes="(min-width: 1140px) 802px, 100vw" /><i className="shade" aria-hidden /><h4>Résultats publics</h4><p>Gagnés, perdus et annulés&nbsp;: tout est compté.</p></div>
            </div>
          </div>
        </section>

        {/* ================= ENGAGEMENTS ================= */}
        <section className="quote" aria-label="Nos engagements">
          <div className="wrap">
            <blockquote data-a="up56" style={{ opacity: quoteVisible ? undefined : 0 }}>{QUOTES[quote]}</blockquote>
            <div className="authors">
              {[["€", "Prix affiché", "Avant chaque déblocage"], ["%", "Transparence", "Résultats publics"], ["18+", "Jeu responsable", "Aucun gain garanti"]].map(([b, t, s], i) => (
                <button type="button" key={t} className={`author${quote === i ? " on" : ""}`} onClick={() => showQuote(i)} aria-pressed={quote === i}>
                  <span className="badge">{b}</span><b>{t}</b><span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ================= COMPÉTITIONS ================= */}
        <section className="coaches" id="competitions" aria-labelledby="competitions-titre">
          <div className="wrap">
            <div data-a="up56"><Pill>Compétitions</Pill><h2 className="h2" id="competitions-titre">Les plus grands championnats.</h2></div>
            <div className="co-view" data-a="up">
              <div className="co-track" ref={coTrack} style={co.style} onTransitionEnd={co.onEnd}>
                {[...comps, ...comps, ...comps].map((comp, i) => (
                  <article key={i} className="coach ph has-img" aria-hidden={i < COMPETITIONS.length || i >= COMPETITIONS.length * 2}>
                    <Photo src={[IMG.sprint, IMG.aerial, IMG.net, IMG.hero, IMG.cta][i % COMPETITIONS.length]} sizes="(min-width: 1140px) 373px, 300px" />
                    <i className="shade" aria-hidden />
                    <span className="country">{comp.country}</span>
                    {comp.logo ? <span className="lg-tile"><LeagueLogo src={comp.logo} name={`Logo ${comp.name}`} size={72} /></span> : null}
                    <div className="glass"><h4>{comp.name}</h4><p>Matchs analysés par PRONEX AI</p></div>
                  </article>
                ))}
              </div>
            </div>
            <div className="co-arrows">
              <button type="button" className="arr" onClick={co.prev} aria-label="Compétition précédente">{LEFT}</button>
              <button type="button" className="arr l" onClick={co.next} aria-label="Compétition suivante">{RIGHT}</button>
            </div>
          </div>
        </section>

        {/* ================= TARIFS ================= */}
        <section className="pricing" id="tarifs" aria-labelledby="tarifs-titre">
          <div className="wrap">
            <div data-a="up56"><Pill>Tarifs</Pill><h2 className="h2" id="tarifs-titre">Choisissez votre pack de crédits</h2></div>
            {packs.length ? (
              <>
                <div className="plans-view" data-a="up">
                  <div className="plans" ref={plansRef} style={{ transform: `translateX(${-planOffset}px)` }}>
                    {packs.map((p, i) => {
                      const k = STYLES[i % STYLES.length];
                      return (
                        <article key={p.id} className={`plan ${k}${k === "photo" ? " ph has-img" : ""}`}>
                          {k === "photo" ? <Photo src={IMG.aerial} className="bg" sizes="367px" /> : null}
                          <div className="top">
                            <div className="tags"><span>{p.is_featured ? "Recommandé" : p.name}</span><span>Paiement unique</span></div>
                            <div className="trust">≈&nbsp;{fr(Math.round(p.price_xof / p.credits))}&nbsp;FCFA<br />par crédit</div>
                          </div>
                          <h4>{p.name}</h4>
                          <p className="credits">{p.credits}<small>crédits</small></p>
                          {pricing ? <p className="desc">Soit {Math.floor(p.credits / pricing.marketMin)} pronostics à {pricing.marketMin} crédits.</p> : null}
                          <div className="price"><b>{fr(p.price_xof)}&nbsp;F</b><small>/ FCFA, une fois</small></div>
                          <p className="inc">Ce qui est inclus</p>
                          <ul>
                            {[`Exactement ${p.credits} crédits, sans bonus`, "Crédits sans date d'expiration", "Sans abonnement", "Reçu pour chaque achat"].map((t) => (
                              <li key={t}>
                                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="8" fill="#c9f13e" /><path d="M4.5 8.2l2.2 2.2 4.8-4.8" stroke="#000" strokeWidth="1.6" fill="none" /></svg>
                                {t}
                              </li>
                            ))}
                          </ul>
                          <div className="foot">
                            <span>Choisir {p.name}</span>
                            <Link className="go" href={`/connexion?next=${encodeURIComponent("/recharger")}`} aria-label={`Choisir le pack ${p.name}`}>{UP_RIGHT}</Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <div className="pl-arrows">
                  <button type="button" className="arr" onClick={() => movePlan(-1)} aria-label="Packs précédents">{LEFT}</button>
                  <button type="button" className="arr l" onClick={() => movePlan(1)} aria-label="Packs suivants">{RIGHT}</button>
                </div>
              </>
            ) : (
              <p className="note">Les packs de crédits sont momentanément indisponibles.</p>
            )}
            {pricing ? (
              <p className="note">
                Un pronostic&nbsp;: {priceLine} crédits selon le type{pricing.bundle ? ` · Match complet : ${pricing.bundle} crédits, moins ce que vous avez déjà payé sur ce match.` : "."}
              </p>
            ) : null}
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section className="faq" id="faq" aria-labelledby="faq-titre">
          <div className="wrap grid">
            <div data-a="up56">
              <Pill>FAQ</Pill>
              <h2 className="h2" id="faq-titre">Des questions&nbsp;? Nous avons les réponses.</h2>
              <div className="img ph has-img">
                <Photo src={IMG.aerial} sizes="(min-width: 1140px) 487px, 100vw" />
                <i className="shade" aria-hidden />
                <div><h4>Plus qu&apos;un pronostic.<br /><em>Une analyse.</em></h4><p>Prédisez. Analysez. Dominez.</p></div>
              </div>
            </div>
            <div data-a="down56">
              {FAQ.map(([q, a], i) => (
                <div key={q} className={`qa${faq === i ? " on" : ""}`}>
                  <button type="button" className="q" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}>
                    {q}<span className="ic" aria-hidden />
                  </button>
                  <div className="a"><p>{a}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= APPEL FINAL ================= */}
        <section className="cta ph has-img" aria-labelledby="cta-titre">
          <Photo src={IMG.cta} className="ctabg" sizes="100vw" />
          <div className="wrap">
            <h2 data-a="up56" id="cta-titre">Prêt à analyser le football autrement&nbsp;?</h2>
            <p data-a="up56">Rejoignez PRONEX et découvrez les analyses de notre intelligence artificielle. Inscription gratuite, paiement à l&apos;unité, sans abonnement.</p>
            <div className="ctas" data-a="up56">
              <Link className="btn btn-lime" href="/inscription">Créer mon compte <span className="dot">{ARROW}</span></Link>
              <Link className="btn btn-glass" href="/performances">Voir les performances <span className="dot">{ARROW}</span></Link>
            </div>
            <div className="cta-card" data-a="up">
              <div className="ph has-img" style={{ position: "relative", height: 210, borderRadius: 12, overflow: "hidden" }} aria-hidden><Photo src={IMG.sprint} sizes="260px" /></div>
              <p>Inscription gratuite. Réservé aux personnes de 18 ans et plus.</p>
              <Link href="/inscription">Commencer</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ================= PIED DE PAGE ================= */}
      <footer>
        <div className="wrap">
          <div className="brand" data-a="up56">
            <Symbol body="#000" ball="#000" accent="#c9f13e" height={172} />
            <span>PRONEX</span>
          </div>
          <div className="fcols">
            <p>Plateforme de pronostics football assistés par intelligence artificielle&nbsp;: analyses match par match, probabilités, niveaux de confiance et résultats publiés en toute transparence.</p>
            <ul>
              <li><a href="#fonctionnement">Fonctionnement</a></li>
              <li><a href="#pronostics">Pronostics</a></li>
              <li><a href="#tarifs">Tarifs</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><Link href="/performances">Performances</Link></li>
            </ul>
            <ul className="soc">
              <li><Link href="/connexion">Connexion</Link></li>
              <li><Link href="/inscription">Inscription</Link></li>
              <li><Link href="/cgu">Conditions</Link></li>
              <li><Link href="/jeu-responsable">Jeu responsable</Link></li>
            </ul>
          </div>
        </div>
        <div className="copy">© {new Date().getFullYear()} PRONEX. Tous droits réservés. <span>· 18+ · Pronostics à titre informatif&nbsp;: aucun gain n&apos;est garanti.</span></div>
      </footer>
    </div>
  );
}
