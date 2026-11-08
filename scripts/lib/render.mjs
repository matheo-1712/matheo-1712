// Rendu Markdown. Aucune donnée de projet n'est écrite ici : tout vient
// de data/projects.json et data/profile.yml, produits par le portfolio.

// Registre des technos : couleur, logo simple-icons, documentation officielle.
// Une techno absente d'ici s'affiche quand même, en gris et sans lien :
// on ne renvoie jamais vers autre chose que la documentation de référence.
const TECH = {
  TypeScript: ["3178C6", "typescript", "white", "https://www.typescriptlang.org/"],
  JavaScript: ["F7DF1E", "javascript", "black", "https://developer.mozilla.org/docs/Web/JavaScript"],
  Rust: ["000000", "rust", "white", "https://www.rust-lang.org/"],
  Java: ["ED8B00", "openjdk", "white", "https://dev.java/"],
  Kotlin: ["7F52FF", "kotlin", "white", "https://kotlinlang.org/"],
  PHP: ["777BB4", "php", "white", "https://www.php.net/"],
  Python: ["3776AB", "python", "white", "https://www.python.org/"],
  "C++": ["00599C", "cplusplus", "white", "https://isocpp.org/"],
  "C#": ["512BD4", "dotnet", "white", "https://learn.microsoft.com/dotnet/csharp/"],
  HTML: ["E34F26", "html5", "white", "https://developer.mozilla.org/docs/Web/HTML"],
  CSS: ["1572B6", "css3", "white", "https://developer.mozilla.org/docs/Web/CSS"],
  Astro: ["BC52EE", "astro", "white", "https://astro.build/"],
  Blade: ["FF2D20", "laravel", "white", "https://laravel.com/docs/blade"],
  Twig: ["1A862C", "twig", "white", "https://twig.symfony.com/"],
  Vue: ["4FC08D", "vuedotjs", "white", "https://vuejs.org/"],
  "Node.js": ["5FA04E", "nodedotjs", "white", "https://nodejs.org/"],
  Express: ["000000", "express", "white", "https://expressjs.com/"],
  Axum: ["000000", "rust", "white", "https://docs.rs/axum/"],
  Laravel: ["FF2D20", "laravel", "white", "https://laravel.com/"],
  "Next.js": ["000000", "nextdotjs", "white", "https://nextjs.org/"],
  Symfony: ["000000", "symfony", "white", "https://symfony.com/"],
  Spring: ["6DB33F", "spring", "white", "https://spring.io/"],
  SQL: ["4479A1", "mysql", "white", "https://dev.mysql.com/doc/"],
  MariaDB: ["003545", "mariadb", "white", "https://mariadb.org/"],
  PocketBase: ["B8DBE4", "pocketbase", "black", "https://pocketbase.io/docs/"],
  Linux: ["FCC624", "linux", "black", "https://www.kernel.org/"],
  Docker: ["2496ED", "docker", "white", "https://www.docker.com/"],
  Dockerfile: ["2496ED", "docker", "white", "https://docs.docker.com/reference/dockerfile/"],
  Nginx: ["009639", "nginx", "white", "https://nginx.org/en/docs/"],
  "CI/CD": ["2088FF", "githubactions", "white", "https://docs.github.com/actions"],
  Git: ["F05032", "git", "white", "https://git-scm.com/"],
  Shell: ["4EAA25", "gnubash", "white", "https://www.gnu.org/software/bash/"],
  Gradle: ["02303A", "gradle", "white", "https://gradle.org/"],
  Android: ["3DDC84", "android", "white", "https://developer.android.com/"],
  Tailwind: ["06B6D4", "tailwindcss", "white", "https://tailwindcss.com/"],
  React: ["61DAFB", "react", "black", "https://react.dev/"],
};

// shields.io : `_` devient une espace et `-` sépare les champs. Il faut donc
// doubler les deux avant d'encoder, sinon « CI/CD » ou « C# » cassent l'URL.
const shield = (s) => encodeURIComponent(String(s).replace(/_/g, "__").replace(/-/g, "--"));

const link = (markdown, href) => (href ? `[${markdown}](${href})` : markdown);

export function techBadge(name, { style = "flat-square" } = {}) {
  const spec = TECH[name];
  if (!spec) {
    return `![${name}](https://img.shields.io/badge/-${shield(name)}-64748B?style=${style})`;
  }
  const [color, logo, logoColor, docs] = spec;
  const url = `https://img.shields.io/badge/-${shield(name)}-${color}?style=${style}&logo=${logo}&logoColor=${logoColor}`;
  return link(`![${name}](${url})`, docs);
}

const fmt = (n) => Number(n ?? 0).toLocaleString("fr-FR").replace(/ | /g, " ");
const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

// Le `|` fermerait la cellule, le retour à la ligne casserait la ligne.
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

// Un résumé de 270 caractères déborde dans un tableau : on coupe au mot.
function shorten(text, max = 125) {
  const s = cell(text);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export const STATUS_LABEL = {
  prod: "En production",
  wip: "En cours",
  paused: "En pause",
  archived: "Archivés",
};

function shareNote(contribution) {
  const { commits = 0, total = 0 } = contribution ?? {};
  if (!commits) return "—";
  if (!total || total === commits) return `\`${fmt(commits)}\``;
  return `\`${fmt(commits)}\` <sub>${Math.round((commits / total) * 100)} %</sub>`;
}

// Deuxième ligne de la cellule projet : résumé, puis type et organisation.
function subtitle(p, orgLabel) {
  const tags = [p.type, p.org ? orgLabel(p.org) : ""].filter(Boolean).map(cell);
  const parts = [shorten(p.summary)].filter(Boolean);
  if (tags.length) parts.push(`**${tags.join(" · ")}**`);
  return parts.join(" <br> ");
}

// `links.demo` pointe selon le projet vers un site, une page Modrinth ou une
// invitation Discord. Le libellé suit l'hôte : annoncer « site » pour une
// invitation Discord serait faux.
const LINK_LABEL = [
  [/(^|\.)modrinth\.com$/, "Modrinth"],
  [/(^|\.)curseforge\.com$/, "CurseForge"],
  [/(^|\.)discord\.(gg|com)$/, "Discord"],
  [/(^|\.)crates\.io$/, "crates.io"],
  [/(^|\.)npmjs\.com$/, "npm"],
];

function linkLabel(key, url) {
  if (key !== "demo") return cell(key);
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [pattern, label] of LINK_LABEL) {
      if (pattern.test(host)) return label;
    }
  } catch {
    // URL inexploitable : on garde le libellé générique.
  }
  return "site";
}

function titleCell(p, orgLabel) {
  const repo = p.links?.repo;
  const name = repo ? `**[${cell(p.title)}](${repo})**` : `**${cell(p.title)}**`;
  const extra = Object.entries(p.links ?? {})
    .filter(([k, v]) => k !== "repo" && v)
    .map(([k, v]) => `[${linkLabel(k, v)} ↗](${v})`);
  const head = [name, ...extra].join(" · ");
  const sub = subtitle(p, orgLabel);
  return sub ? `${head}<br><sub>${sub}</sub>` : head;
}

export function projectTable(projects, { orgLabel = (o) => o } = {}) {
  if (projects.length === 0) return "_Aucun projet dans cette catégorie._";
  const head = "| Projet | Stack | Version | Commits |\n|---|---|:---:|:---:|";
  const rows = projects.map((p) => {
    const stack = (p.stack ?? []).map((t) => techBadge(t)).join(" ") || "—";
    const version = p.version ? `\`${cell(p.version)}\`${p.prerelease ? " <sub>pre</sub>" : ""}` : "—";
    return `| ${titleCell(p, orgLabel)} | ${stack} | ${version} | ${shareNote(p.contribution)} |`;
  });
  return [head, ...rows].join("\n");
}

// Les projets archivés sont nombreux et secondaires : repliés par défaut.
export function collapsed(summary, body) {
  return `<details>\n<summary><b>${summary}</b></summary>\n\n${body}\n\n</details>`;
}

// data/projects.json porte la version courante mais pas la date de sa
// publication : `updated` est la date du dernier push. On annonce donc une
// activité récente, pas une date de sortie — ce serait faux.
export function recentActivity(projects, limit = 6) {
  const items = projects
    .filter((p) => p.updated)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, limit);
  if (items.length === 0) return "_Aucune activité récente._";
  return items
    .map((p) => {
      const repo = p.links?.repo;
      const name = repo ? `[${cell(p.title)}](${repo})` : cell(p.title);
      const version = p.version ? ` → \`${cell(p.version)}\`` : "";
      return `- \`${day(p.updated)}\` **${name}**${version}`;
    })
    .join("\n");
}

// Les groupes viennent de data/profile.yml du portfolio : un seul endroit
// à modifier pour que le site et le README disent la même chose.
export function stackSection(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return "_Stack non renseignée._";
  return skills
    .filter((g) => g?.group && Array.isArray(g.items) && g.items.length)
    .map((g) => `**${cell(g.group)}**\n\n${g.items.map((t) => techBadge(t, { style: "for-the-badge" })).join("\n")}`)
    .join("\n\n");
}

// Langages réellement présents dans les projets publiés, avec leur nombre
// d'apparitions. Rien à maintenir : la liste suit les dépôts.
export function languageBar(projects) {
  const count = new Map();
  for (const p of projects) {
    for (const t of p.stack ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  }
  if (count.size === 0) return "";
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .map(([t, n]) => `${techBadge(t)} <sub>${n}</sub>`)
    .join(" ");
}

export function statBadges(stats, derived) {
  const badge = (label, value, color) =>
    `![${label}](https://img.shields.io/badge/${shield(label)}-${shield(value)}-${color}?style=for-the-badge)`;
  const search = (q, type) => `https://github.com/search?q=${encodeURIComponent(q)}&type=${type}`;
  const user = derived.user;
  const orgQuery = derived.orgs.map((o) => `org:${o}`).join(" ");

  const rows = [
    ["Commits", fmt(stats.commits), "7C3AED", search(`author:${user}`, "commits")],
    ["Pull requests", fmt(stats.prs), "7C3AED", search(`author:${user} type:pr`, "pullrequests")],
    ["Fusionnées", `${fmt(stats.merged)} / ${fmt(stats.prs)}`, "16A34A", search(`author:${user} type:pr is:merged`, "pullrequests")],
    ["Issues", fmt(stats.issues), "7C3AED", search(`author:${user} type:issue`, "issues")],
    ["Dépôts", fmt(stats.repos), "7C3AED", `https://github.com/${user}?tab=repositories`],
    // Projets, versions et étoiles sont comptés sur data/projects.json :
    // le portfolio est la page qui les détaille.
    ["Projets publiés", fmt(derived.projectCount), "7C3AED", derived.portfolio],
    ["En production", fmt(derived.prodCount), "16A34A", derived.portfolio],
    ["Commits en équipe", `${stats.orgShare} %`, "16A34A", derived.orgs.length ? search(`author:${user} ${orgQuery}`, "commits") : ""],
    // Aucune page ne liste « toutes mes étoiles » : badge non cliquable.
    ["Étoiles reçues", fmt(derived.stars), "64748B", ""],
    ["Sur GitHub depuis", String(stats.since ?? ""), "64748B", ""],
  ];

  return rows
    .filter(([, value]) => value !== "" && value !== "null")
    .map(([label, value, color, href]) => link(badge(label, value, color), href))
    .join("\n");
}

export function bannerUrl({ role, stats, derived }) {
  const lines = [
    role,
    derived.topLangs.join(" · "),
    `${fmt(derived.projectCount)} projets publiés · ${fmt(derived.prodCount)} en production`,
    `${fmt(stats.commits)} commits · ${fmt(stats.prs)} pull requests`,
  ].filter(Boolean);

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
