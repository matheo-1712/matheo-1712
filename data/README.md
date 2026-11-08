# data/

Instantanés versionnés. **Aucun fichier ici ne s'édite à la main** : ils sont
réécrits par `scripts/build-readme.mjs` à chaque génération.

| Fichier | Origine | Rôle |
|---|---|---|
| `projects.json` | `matheo-1712.github.io` · `data/projects.json` | les projets affichés |
| `profile.yml` | `matheo-1712.github.io` · `data/profile.yml` | identité, accroche, stack |
| `stats.json` | API search de GitHub | commits, pull requests, issues, dépôts |

Les compteurs de `stats.json` ne couvrent que les dépôts visibles par le jeton
utilisé. Sans secret `README_TOKEN`, le workflow tourne avec le jeton d'Actions,
qui ne voit que le public : le travail fait en dépôt privé n'est pas compté.

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
