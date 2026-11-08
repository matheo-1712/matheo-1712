# data/

Instantanés versionnés. **Aucun fichier ici ne s'édite à la main** : ils sont
réécrits par `scripts/build-readme.mjs` à chaque génération.

| Fichier | Origine | Rôle |
|---|---|---|
| `projects.json` | `matheo-1712.github.io` · `data/projects.json` | les projets affichés |
| `profile.yml` | `matheo-1712.github.io` · `data/profile.yml` | identité, accroche, stack |
| `stats.json` | API search de GitHub | commits, pull requests, issues, dépôts |

## Pourquoi les committer

Si le portfolio ou l'API GitHub ne répond pas — quota dépassé, panne, réseau —
la génération repart du dernier instantané valide. Le README reste juste, avec
les données de la veille, au lieu de se vider.

C'est pour ça que le workflow committe `data/` en même temps que `README.md`.

## Où corriger quoi

Rien ne se corrige ici : les modifications seraient écrasées au prochain
passage. La source est le dépôt du portfolio :

- ajouter ou retirer un projet → topic `portfolio` sur le dépôt concerné ;
- titre, résumé, fusion, masquage → `data/overrides.yml` du portfolio ;
- identité, accroche, stack → `data/profile.yml` du portfolio.
