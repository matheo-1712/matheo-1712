<!-- Fichier généré par scripts/build-readme.mjs — édite README.template.md, pas celui-ci. -->
<div align="center">

# {{NAME}}

<img src="{{BANNER}}" alt="{{ROLE}}" />

{{LINKS}}

{{HEADLINE}}

<sub>{{SUBLINE}}</sub>

<sub>{{FACTS}}</sub>

</div>

## Stats

<div align="center">

{{STATS}}

</div>

## Projets

> Les projets ci-dessous sont collectés automatiquement : un dépôt apparaît ici
> dès qu'il porte le topic [`portfolio`](https://github.com/search?q=user%3A{{USER}}+topic%3Aportfolio&type=repositories)
> sur GitHub. Même liste, mêmes descriptions et mêmes versions que sur
> **[{{PORTFOLIO_URL}}]({{PORTFOLIO_URL}})** — rien n'est écrit à la main.
>
> La colonne **Commits** indique les miens, et leur part dans le dépôt.

### En production

{{PROJECTS_PROD}}

### En cours

{{PROJECTS_WIP}}

### Archivés

{{PROJECTS_ARCHIVED}}

## Activité récente

<sub>Derniers dépôts poussés, avec leur version courante.</sub>

{{RECENT}}

## Stack

**Langages des projets publiés** <sub>— nombre de projets</sub>

{{LANGUAGES}}

{{STACK}}

## Activité

<!-- Cartes générées à la volée : ce sont des images, aucun lien à ouvrir. -->
<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username={{USER}}&theme=github_dark" />
  <img src="https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username={{USER}}&theme=github" width="820" alt="Statistiques GitHub" />
</picture>

<img src="https://ghchart.rshah.org/7C3AED/{{USER}}" width="820" alt="Graphe de contributions" />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://streak-stats.demolab.com?user={{USER}}&hide_border=true&theme=github-dark&ring=7C3AED&fire=7C3AED&currStreakLabel=7C3AED" />
  <img src="https://streak-stats.demolab.com?user={{USER}}&hide_border=true&theme=default&ring=7C3AED&fire=7C3AED&currStreakLabel=7C3AED" height="170" alt="Série de contributions" />
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github-profile-summary-cards.vercel.app/api/cards/most-commit-language?username={{USER}}&theme=github_dark" />
  <img src="https://github-profile-summary-cards.vercel.app/api/cards/most-commit-language?username={{USER}}&theme=github" height="170" alt="Langages par commits" />
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github-profile-summary-cards.vercel.app/api/cards/productive-time?username={{USER}}&theme=github_dark&utcOffset=2" />
  <img src="https://github-profile-summary-cards.vercel.app/api/cards/productive-time?username={{USER}}&theme=github&utcOffset=2" height="170" alt="Heures productives" />
</picture>

</div>

## Ce README se met à jour tout seul

<details>
<summary><b>Comment ça marche</b></summary>

Je ne touche jamais à `README.md` : il est reconstruit chaque matin.

```
topic `portfolio` sur un dépôt
        │
        ▼
collecte du portfolio ──► {{PORTFOLIO_REPO}} : data/projects.json
        │
        ▼
scripts/build-readme.mjs + README.template.md ──► README.md
```

| Je veux… | Fichier à modifier |
|---|---|
| ajouter un projet | le topic `portfolio` sur le dépôt, sur GitHub |
| retirer un projet | enlever le topic, ou `hidden: true` dans `data/overrides.yml` du portfolio |
| corriger un titre ou un résumé | `data/overrides.yml` du portfolio |
| fusionner deux dépôts | `alias_of:` dans `data/overrides.yml` du portfolio |
| changer la stack affichée | `data/profile.yml` du portfolio |
| changer la mise en page | `README.template.md` de ce dépôt |

Les descriptions, versions, langages et parts de commits viennent de la même
source que le portfolio : les deux ne peuvent pas se contredire.

Si GitHub ou le portfolio ne répond pas, la génération repart du dernier
instantané committé dans `data/` : le README reste juste, avec les données de
la veille, au lieu de se vider.

</details>

## Contact

<div align="center">

{{LINKS}}

<sub>{{PROJECT_COUNT}} projets collectés · {{PROD_COUNT}} en production · généré automatiquement le {{UPDATED}}</sub>

</div>
