#!/usr/bin/env node
// Génère README.md à partir de README.template.md et de l'API GitHub.
// Aucune dépendance : Node 20+ (fetch natif).

import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";

const USER = process.env.GH_USER ?? "matheo-1712";
const ORGS = (process.env.GH_ORGS ?? "L-Antre-des-Loutres").split(",").filter(Boolean);
const TOKEN = process.env.GITHUB_TOKEN ?? "";

// Un projet n'est retenu que s'il a des releases, assez de commits de ma part,
// et que ces commits représentent une part réelle du dépôt.
const MIN_COMMITS = 40;
const MIN_SHARE = 0.4;
const TOP_TEAM = 6;
const TOP_SOLO = 6;
const RECENT_COUNT = 5;

// Descriptions courtes, volontairement lisibles en anglais comme en français.
// Si un dépôt n'est pas listé ici, sa description GitHub est utilisée.
const DESC = {
  Astroloutre: "Community website · member stats & achievements",
  "Cobblemon-RLM": "Minecraft datapack + resourcepack · custom creature roster",
  OtterlyApi: "Game server management API · install, start, stop over HTTP",
  Arisoutre: "Discord admin bot · member management",
  Otterbots: "Discord bot framework · native events, commands, channels",
  Mateloutre: "Community Discord bot · Docker deployment",
  OAPI: "Async orchestration API · image generation, infra monitoring",
  Citlali: "Genshin Impact Discord bot",
  WatchSide: "Movie rental platform · dynamic pricing, user roles",
  CitlAPI: "REST API powering Citlali",
  "cobblemon-trainers": "Minecraft mod · configurable trainers",
  OtterlyAPI: "Game server management API",
  OtterMinded: "Anonymous social mobile app",
};

// Dépôts à ne jamais afficher (doublons, archives remplacées...). Format `owner/name`.
const EXCLUDE = new Set([
  "matheo-1712/OtterlyAPI", // repris et poursuivi sous L-Antre-des-Loutres/OtterlyApi
]);

// Langages de configuration/markup : comptés dans les projets, mais hors bandeau.
const NOT_A_SELLING_POINT = new Set([
  "mcfunction", "Dockerfile", "HTML", "CSS", "Twig", "Blade", "Shell",
  "Makefile", "Batchfile", "PowerShell", "Procfile", "SCSS", "Less", "Vue", "Handlebars",
]);

// Destination officielle de chaque techno. Un langage absent d'ici reste
// affiché, mais sans lien : on ne renvoie jamais vers une simple image.
const DOCS = {
  TypeScript: "https://www.typescriptlang.org/",
  JavaScript: "https://developer.mozilla.org/docs/Web/JavaScript",
  Rust: "https://www.rust-lang.org/",
  Java: "https://dev.java/",
  Kotlin: "https://kotlinlang.org/",
  PHP: "https://www.php.net/",
  "C++": "https://isocpp.org/",
  "C#": "https://learn.microsoft.com/dotnet/csharp/",
  Astro: "https://astro.build/",
  HTML: "https://developer.mozilla.org/docs/Web/HTML",
  CSS: "https://developer.mozilla.org/docs/Web/CSS",
  Ruby: "https://www.ruby-lang.org/",
  Dockerfile: "https://docs.docker.com/reference/dockerfile/",
  Twig: "https://twig.symfony.com/",
  Vue: "https://vuejs.org/",
  Shell: "https://www.gnu.org/software/bash/",
};

const BADGE = {
  TypeScript: "TypeScript-3178C6?logo=typescript&logoColor=white",
  JavaScript: "JavaScript-F7DF1E?logo=javascript&logoColor=black",
  Rust: "Rust-000000?logo=rust&logoColor=white",
  Java: "Java-ED8B00?logo=openjdk&logoColor=white",
  Kotlin: "Kotlin-7F52FF?logo=kotlin&logoColor=white",
  PHP: "PHP-777BB4?logo=php&logoColor=white",
  "C++": "C++-00599C?logo=cplusplus&logoColor=white",
  "C#": "C%23-512BD4?logo=dotnet&logoColor=white",
  Astro: "Astro-BC52EE?logo=astro&logoColor=white",
  HTML: "HTML-E34F26?logo=html5&logoColor=white",
  CSS: "CSS-1572B6?logo=css3&logoColor=white",
  Ruby: "Ruby-CC342D?logo=ruby&logoColor=white",
  Dockerfile: "Docker-2496ED?logo=docker&logoColor=white",
};

const api = "https://api.github.com";
const headers = {
  "User-Agent": `${USER}-readme-builder`,
  Accept: "application/vnd.github+json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function gh(path, { accept } = {}) {
  const url = path.startsWith("http") ? path : api + path;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: accept ? { ...headers, Accept: accept } : headers });
    if (res.ok) return res.json();
    // 403/429 = rate limit : on attend la fenêtre indiquée par l'API.
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
      const wait = Math.min(Math.max(reset - Date.now(), 2000), 60_000);
      console.warn(`rate limit sur ${url}, attente ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 404) return null;
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }
  throw new Error(`échec après plusieurs tentatives — ${url}`);
}

async function ghAll(path) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await gh(`${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// L'API search est limitée à ~10 req/min sans token, 30 avec.
let lastSearch = 0;
async function searchCount(kind, q) {
  const gap = TOKEN ? 2200 : 7000;
  const since = Date.now() - lastSearch;
  if (since < gap) await new Promise((r) => setTimeout(r, gap - since));
  lastSearch = Date.now();
  const accept = kind === "commits" ? "application/vnd.github.cloak-preview+json" : undefined;
  const res = await gh(`/search/${kind}?q=${encodeURIComponent(q)}&per_page=1`, { accept });
  return res?.total_count ?? 0;
}

const fmt = (n) => n.toLocaleString("en-US");
const day = (iso) => (iso ? iso.slice(0, 10) : "");

// Rend l'image cliquable seulement si on a une vraie destination.
const linked = (img, href) => (href ? `[${img}](${href})` : img);

function langBadge(lang) {
  if (!lang) return "";
  const spec = BADGE[lang] ?? `${encodeURIComponent(lang)}-64748B`;
  const sep = spec.includes("?") ? "&" : "?";
  return linked(`![${lang}](https://img.shields.io/badge/-${spec}${sep}style=flat-square)`, DOCS[lang]);
}

export async function collectRepo(repo) {
  const [contributors, releases, languages] = await Promise.all([
    ghAll(`/repos/${repo.full_name}/contributors`),
    ghAll(`/repos/${repo.full_name}/releases`),
    gh(`/repos/${repo.full_name}/languages`),
  ]);

  const total = contributors.reduce((sum, c) => sum + c.contributions, 0);
  const mine = contributors.find((c) => c.login?.toLowerCase() === USER.toLowerCase())?.contributions ?? 0;
  const published = releases.filter((r) => !r.draft);
  const latest = published[0] ?? null;

  return {
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    owner: repo.owner.login,
    isOrg: repo.owner.login.toLowerCase() !== USER.toLowerCase(),
    description: DESC[repo.name] ?? repo.description ?? "",
    mine,
    share: total > 0 ? mine / total : 0,
    releases: published.length,
    latestTag: latest?.tag_name ?? "",
    latestDate: latest?.published_at ?? "",
    langs: Object.keys(languages ?? {}).slice(0, 2),
  };
}

export function projectTable(rows) {
  if (rows.length === 0) return "_No project matches the criteria yet._";
  const head =
    "| Project | | Commits | Releases | Latest | Stack |\n|---|---|:---:|:---:|:---:|---|";
  const body = rows.map((r) => {
    const stack = r.langs.map(langBadge).join(" ");
    const latest = r.latestTag ? `\`${r.latestTag}\` <sub>${day(r.latestDate)}</sub>` : "—";
    return `| **[${r.name}](${r.url})** | ${r.description} | \`${r.mine}\` | \`${r.releases}\` | ${latest} | ${stack} |`;
  });
  return [head, ...body].join("\n");
}

export function statBadges(s) {
  const img = (label, value, color) =>
    `![${label}](https://img.shields.io/badge/${encodeURIComponent(label).replace(/%20/g, "_")}-${encodeURIComponent(value)}-${color}?style=for-the-badge)`;
  // Chaque compteur pointe vers la recherche GitHub qui le reproduit : le chiffre est vérifiable.
  const find = (query, type) => `https://github.com/search?q=${encodeURIComponent(query)}&type=${type}`;
  const orgQuery = ORGS.map((o) => `org:${o}`).join(" ");

  return [
    ["Commits", fmt(s.commits), "7C3AED", find(`author:${USER}`, "commits")],
    ["Pull requests", fmt(s.prs), "7C3AED", find(`author:${USER} type:pr`, "pullrequests")],
    ["Merged", `${fmt(s.merged)} / ${fmt(s.prs)}`, "16A34A", find(`author:${USER} type:pr is:merged`, "pullrequests")],
    ["Issues", fmt(s.issues), "7C3AED", find(`author:${USER} type:issue`, "issues")],
    ["Repositories", fmt(s.repos), "7C3AED", `https://github.com/${USER}?tab=repositories`],
    // Pas d'URL fiable pour l'ensemble des releases : badge non cliquable.
    ["Releases", fmt(s.releases), "7C3AED", ""],
    ["Org / team commits", `${s.orgShare}%`, "16A34A", ORGS.length ? find(`author:${USER} ${orgQuery}`, "commits") : ""],
    // Rien d'utile à ouvrir : on laisse le badge non cliquable.
    ["GitHub since", String(s.since), "64748B", ""],
  ]
    .map(([label, value, color, href]) => linked(img(label, value, color), href))
    .join("\n");
}

export function bannerUrl(s) {
  const lines = [
    "Backend & full-stack developer",
    s.topLangs.join(" · "),
    `${fmt(s.commits)} commits · ${fmt(s.prs)} pull requests · ${s.releases} releases`,
    "Open to work · Ouvert aux opportunités",
  ];
  const params = new URLSearchParams({
    font: "JetBrains Mono",
    weight: "600",
    size: "21",
    duration: "3000",
    pause: "900",
    color: "7C3AED",
    center: "true",
    vCenter: "true",
    width: "680",
    height: "45",
    lines: lines.join(";"),
  });
  return `https://readme-typing-svg.demolab.com?${params}`;
}

export function recentList(repos) {
  const items = repos
    .filter((r) => r.latestDate)
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
    .slice(0, RECENT_COUNT);
  if (items.length === 0) return "_No recent release._";
  return items
    .map((r) => `- \`${day(r.latestDate)}\` **[${r.name}](${r.url})** → \`${r.latestTag}\``)
    .join("\n");
}

export async function main() {
  console.log(`collecte pour ${USER}${TOKEN ? " (authentifié)" : " (anonyme, quotas serrés)"}`);

  const profile = await gh(`/users/${USER}`);
  const ownRepos = await ghAll(`/users/${USER}/repos?sort=pushed`);
  const orgRepos = (await Promise.all(ORGS.map((o) => ghAll(`/orgs/${o}/repos?sort=pushed`)))).flat();

  const candidates = [...ownRepos, ...orgRepos].filter(
    (r) => !r.fork && r.name !== ".github" && !r.private,
  );
  console.log(`${candidates.length} dépôts à inspecter`);

  const detailed = [];
  for (const repo of candidates) {
    detailed.push(await collectRepo(repo));
  }

  const mine = detailed.filter((r) => r.share >= MIN_SHARE && r.mine > 0);
  const eligible = mine
    .filter((r) => r.releases > 0 && r.mine >= MIN_COMMITS && !EXCLUDE.has(r.fullName))
    .sort((a, b) => b.mine - a.mine);

  const team = eligible.filter((r) => r.isOrg).slice(0, TOP_TEAM);
  const solo = eligible.filter((r) => !r.isOrg).slice(0, TOP_SOLO);

  const orgFilter = ORGS.map((o) => `org:${o}`).join(" ");
  const commits = await searchCount("commits", `author:${USER}`);
  const orgCommits = ORGS.length ? await searchCount("commits", `author:${USER} ${orgFilter}`) : 0;
  const prs = await searchCount("issues", `author:${USER} type:pr`);
  const merged = await searchCount("issues", `author:${USER} type:pr is:merged`);
  const issues = await searchCount("issues", `author:${USER} type:issue`);

  const byLang = new Map();
  for (const r of mine) {
    for (const l of r.langs) byLang.set(l, (byLang.get(l) ?? 0) + r.mine);
  }
  const topLangs = [...byLang.entries()]
    .filter(([l]) => !NOT_A_SELLING_POINT.has(l))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([l]) => l);

  const stats = {
    commits,
    prs,
    merged,
    issues,
    repos: candidates.length,
    releases: mine.reduce((sum, r) => sum + r.releases, 0),
    orgShare: commits > 0 ? Math.round((orgCommits / commits) * 100) : 0,
    since: new Date(profile.created_at).getUTCFullYear(),
    topLangs,
  };
  console.log(stats);

  const template = await readFile(new URL("../README.template.md", import.meta.url), "utf8");
  const output = template
    .replaceAll("{{BANNER}}", bannerUrl(stats))
    .replaceAll("{{STATS}}", statBadges(stats))
    .replaceAll("{{PROJECTS_TEAM}}", projectTable(team))
    .replaceAll("{{PROJECTS_SOLO}}", projectTable(solo))
    .replaceAll("{{RECENT}}", recentList(eligible))
    .replaceAll("{{UPDATED}}", new Date().toISOString().slice(0, 10));

  if (output.includes("{{")) {
    throw new Error("un placeholder n'a pas été remplacé");
  }

  await writeFile(new URL("../README.md", import.meta.url), output);
  console.log(`README.md écrit — ${team.length} projets équipe, ${solo.length} solo`);
}

const isEntry = argv[1] && import.meta.url === new URL(`file://${argv[1].replace(/\\/g, "/")}`).href;
if (isEntry || process.env.README_RUN === "1") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}