/**
 * Symbole PRONEX (validé le 27/11/2026) : « P » massif, ballon dans la boucle.
 * body = lettre, ball = ballon, accent = pentagone du ballon.
 */
export function PronexMark({
  body = "currentColor",
  ball = "#c9f13e",
  accent = "currentColor",
  className,
  height,
}: {
  body?: string;
  ball?: string;
  accent?: string;
  className?: string;
  height?: number;
}) {
  return (
    <svg className={className} viewBox="0 0 100 120" height={height} aria-hidden>
      <path
        fill={body}
        fillRule="evenodd"
        d="M0 14A14 14 0 0 1 14 0H54A48 48 0 0 1 54 96H38V106A14 14 0 0 1 24 120H14A14 14 0 0 1 0 106ZM54 24A24 24 0 1 0 54 72A24 24 0 1 0 54 24Z"
      />
      <circle cx="54" cy="48" r="12" fill={ball} />
      <path d="M54 40.5l7 5.1-2.7 8.2h-8.6l-2.7-8.2z" fill={accent} />
    </svg>
  );
}
