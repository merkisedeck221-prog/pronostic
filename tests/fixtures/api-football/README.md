# Réponses API-Football enregistrées (tests unitaires)

Les tests unitaires n'appellent **jamais** l'API (quota de 100 requêtes/jour en forfait gratuit) :
ils lisent ces fichiers.

**Origine actuelle** : fichiers construits d'après la documentation officielle d'API-Football v3
(structure `get / parameters / errors / results / paging / response`), avec des valeurs fictives.

**À remplacer** par des réponses réelles : chaque exécution du workflow « API-Football » enregistre
les réponses brutes (sans la clé) dans l'artefact `api-samples/` (option `SAVE_API_SAMPLES`).
Copier ici les fichiers utiles et adapter les attentes des tests si besoin.
