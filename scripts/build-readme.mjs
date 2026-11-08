#!/usr/bin/env node
// Génère README.md à partir de README.template.md.
//
// Ce script ne décrit AUCUN projet. La liste, les descriptions, les versions
// et la stack viennent de mon portfolio, qui collecte GitHub chaque matin :
//
//   topic `portfolio` sur un dépôt  ->  collecte du portfolio  ->  ce README
//
// Ajouter un projet au README = poser le topic sur le dépôt. Rien à éditer ici.
// Corriger un titre, masquer un projet, en fusionner deux : data/overrides.yml
// du portfolio. Changer la stack affichée ou l'identité : data/profile.yml.
//
// Node 20+, aucune dépendance.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";

import { fetchStats } from "./lib/github.mjs";
import { loadProjects, loadProfile, loadStats } from "./lib/sources.mjs";
import {
  bannerUrl,
  projectGrid,
  recentActivity,
  stackTable,
  statBadges,
} from "./lib/render.mjs";

const USER = process.env.GH_USER ?? "matheo-1712";
const ORGS = (process.env.GH_ORGS ?? "L-Antre-des-Loutres").split(",").filter(Boolean);
// Année d'arrivée sur GitHub : une constante, pas un appel réseau.
const SINCE = Number(process.env.GH_SINCE ?? 2022);

// Dépôt du portfolio : c'est lui qui produit les données.
const PORTFOLIO_REPO = process.env.PORTFOLIO_REPO ?? "matheo-1712/matheo-1712.github.io";
const PORTFOLIO_REF = process.env.PORTFOLIO_REF ?? "main";
const raw = (path) => `https://raw.githubusercontent.com/${PORTFOLIO_REPO}/${PORTFOLIO_REF}/${path}`;

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const PATHS = {
  template: here("../README.template.md"),
  readme: here("../README.md"),
  projects: here("../data/projects.json"),
  profile: here("../data/profile.yml"),
  stats: here("../data/stats.json"),
};

// Langages de balisage ou de configuration : comptés dans les projets, mais
// jamais mis en avant dans le bandeau — ce n'est pas ce que je sais faire.
const NOT_A_SELLING_POINT = new Set([
  "HTML", "CSS", "SCSS", "Less", "Blade", "Twig", "Handlebars", "mcfunction",
  "Dockerfile", "Shell", "Makefile", "Batchfile", "PowerShell", "Procfile",
]);

const STATUS_ORDER = ["prod", "wip", "paused", "archived"];

// Nom lisible des organisations. Le login GitHub sert de repli : il est exact,
// juste moins joli. C'est de la présentation, aucune donnée de projet.
const ORG_LABEL = {
  "l-antre-des-loutres": "L'Antre des Loutres",
  "lp-applications-web-angers-2025-2026": "LP Applications web · Angers",
};
const orgLabel = (org) => ORG_LABEL[String(org).toLowerCase()] ?? org;

// Au sein d'un même état : les projets mis en avant, puis ceux où j'ai le plus
// investi. L'ancienneté est déjà traitée par la section « Dernières sorties ».
function byInvestment(a, b) {
  if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
  const ca = a.contribution?.commits ?? 0;
  const cb = b.contribution?.commits ?? 0;
  if (ca !== cb) return cb - ca;
  return String(a.title).localeCompare(String(b.title), "fr");
}

function topLanguages(projects, limit = 5) {
  const weight = new Map();
  for (const p of projects) {
    const commits = p.contribution?.commits ?? 1;
    for (const t of p.stack ?? []) {
      if (NOT_A_SELLING_POINT.has(t)) continue;
      weight.set(t, (weight.get(t) ?? 0) + commits);
    }
  }
  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, limit)
    .map(([t]) => t);
}

function headerLinks(identity, portfolioUrl, cvUrl) {
  const badge = (label, value, color, logo, logoColor = "white") =>
    `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)
      .replace(/-/g, "--")}-${color}?style=for-the-badge&logo=${logo}&logoColor=${logoColor}`;

  const out = [];
  if (portfolioUrl) {
    const shown = portfolioUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    out.push(`[![Portfolio](${badge("Portfolio", shown, "2563EB", "googlechrome")})](${portfolioUrl})`);
  }
  if (identity.email) {
    out.push(`[![Email](${badge("Email", identity.email, "EA4335", "gmail")})](mailto:${identity.email})`);
  }
  // Affiché seulement si renseigné dans profile.yml : pas de lien mort.
  if (identity.linkedin) {
    out.push(`[![LinkedIn](${badge("LinkedIn", "profil", "0A66C2", "linkedin")})](${identity.linkedin})`);
  }
  if (cvUrl) {
    out.push(`[![CV](${badge("CV", "PDF", "DC2626", "adobeacrobatreader")})](${cvUrl})`);
  }
  if (ORGS.length) {
    const label = orgLabel(ORGS[0]);
    out.push(`[![${label}](${badge("Org", label, "7C3AED", "github")})](https://github.com/${ORGS[0]})`);
  }
  return out.join("\n");
}

function factsTable(facts) {
  const rows = (facts ?? []).filter((f) => f?.label && f?.value);
  if (rows.length === 0) return "";
  return rows.map((f) => `**${f.label}** · ${f.value}`).join(" <br> ");
}

export async function main() {
  console.log(`source des projets : ${PORTFOLIO_REPO}@${PORTFOLIO_REF}`);

  const token = process.env.GITHUB_TOKEN ?? "";
  const [{ projects, fresh: projectsFresh }, profile] = await Promise.all([
    loadProjects({ url: raw("data/projects.json"), cache: PATHS.projects }),
    loadProfile({ url: raw("data/profile.yml"), cache: PATHS.profile }),
  ]);

  const { stats } = await loadStats({
    cache: PATHS.stats,
    collect: () => fetchStats({ user: USER, orgs: ORGS, token, since: SINCE }),
  });

  const identity = profile.identity ?? {};
  const portfolioUrl = profile.seo?.url ?? `https://${USER}.github.io`;

  const groups = new Map(STATUS_ORDER.map((s) => [s, []]));
  for (const p of projects) {
    const status = groups.has(p.status) ? p.status : "wip";
    groups.get(status).push(p);
  }
  for (const list of groups.values()) list.sort(byInvestment);

  // « En pause » rejoint « En cours » : deux tableaux d'un projet chacun
  // n'apportent rien, et un projet en pause reste un projet vivant.
  const active = [...groups.get("prod")];
  const ongoing = [...groups.get("wip"), ...groups.get("paused")].sort(byInvestment);
  const archived = groups.get("archived");

  const derived = {
    user: USER,
    orgs: ORGS,
    portfolio: portfolioUrl,
    projectCount: projects.length,
    prodCount: active.length,
    stars: projects.reduce((sum, p) => sum + (p.stars ?? 0), 0),
    topLangs: topLanguages(projects),
  };
  console.log(
    `${projects.length} projets (${active.length} en production, ${ongoing.length} en cours, ` +
      `${archived.length} archivés)${projectsFresh ? "" : " — données de l'instantané"}`,
  );

  const cvUrl = identity.cv
    ? new URL(identity.cv, `${portfolioUrl.replace(/\/$/, "")}/`).href
    : "";

  const values = {
    NAME: identity.name ?? USER,
    ROLE: identity.role ?? "",
    HEADLINE: profile.headline ?? "",
    SUBLINE: profile.subline ?? "",
    FACTS: factsTable(profile.facts),
    LINKS: headerLinks(identity, portfolioUrl, cvUrl),
    BANNER: bannerUrl({ role: identity.role, stats, derived }),
    STATS: statBadges(stats, derived),
    RECENT: recentActivity(projects),
    // Deux colonnes pour les projets vivants, trois pour les archivés : tout
    // reste affiché, sans que la page s'allonge inutilement.
    PROJECTS_PROD: projectGrid(active, { columns: 2, orgLabel }),
    PROJECTS_WIP: projectGrid(ongoing, { columns: 2, orgLabel }),
    PROJECTS_ARCHIVED: projectGrid(archived, { columns: 3, orgLabel, compact: true }),
    ARCHIVED_COUNT: String(archived.length),
    WIP_COUNT: String(ongoing.length),
    STACK: stackTable(profile.skills, projects),
    PROJECT_COUNT: String(projects.length),
    PROD_COUNT: String(active.length),
    PORTFOLIO_URL: portfolioUrl,
    PORTFOLIO_REPO,
    USER,
    CV_URL: cvUrl,
    UPDATED: new Date().toISOString().slice(0, 10),
  };

  const template = await readFile(PATHS.template, "utf8");
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }

  const leftover = output.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) throw new Error(`placeholder non remplacé : ${[...new Set(leftover)].join(", ")}`);

  await writeFile(PATHS.readme, output);
  console.log(`README.md écrit (${output.length} caractères)`);
}

const isEntry = argv[1] && import.meta.url === new URL(`file://${argv[1].replace(/\\/g, "/")}`).href;
if (isEntry || process.env.README_RUN === "1") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
