/**
 * Thème de l'interface (27/11/2026) : clair (design PRONEX) ou sombre « Carbone ».
 * Classe `pxdark` sur <html>. Choix mémorisé sur l'appareil ; sans choix, le
 * thème suit le réglage du téléphone ou de l'ordinateur. Appliqué avant
 * l'affichage (aucun flash) par THEME_SCRIPT. La landing n'est pas concernée.
 */
export const THEME_STORAGE_KEY = "pronex-theme";
export const DARK_CLASS = "pxdark";
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("${DARK_CLASS}");}}catch(e){}`;
