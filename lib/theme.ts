/**
 * Thème de l'interface : sombre PRONEX (par défaut) ou clair noir et blanc.
 * Choix mémorisé sur l'appareil ; appliqué avant l'affichage par THEME_SCRIPT.
 */
export const THEME_STORAGE_KEY = "pronex-theme";

/** Script inséré dans <head> : applique le thème mémorisé avant le premier rendu (aucun flash). */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light"){var d=document.documentElement;d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light";}}catch(e){}`;
