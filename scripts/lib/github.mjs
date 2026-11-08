// Accès à l'API GitHub : uniquement les compteurs globaux du profil.
// Les projets ne passent pas par ici — ils viennent du portfolio.

const API = "https://api.github.com";

export function client({ user, token }) {
  const headers = {
    "User-Agent": `${user}-readme-builder`,
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  async function gh(path, { accept } = {}) {
    const url = path.startsWith("http") ? path : API + path;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: accept ? { ...headers, Accept: accept } : headers });
      if (res.ok) return res.json();
      if (res.status === 404) return null;
      // 403/429 : quota. On attend la fenêtre que l'API annonce, sans
      // dépasser une minute — le workflow ne doit pas traîner une heure.
      if (res.status === 403 || res.status === 429) {
        const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
        const wait = Math.min(Math.max(reset - Date.now(), 2000), 60_000);
        console.warn(`quota atteint sur ${url}, attente ${Math.round(wait / 1000)}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`${res.status} ${res.statusText} — ${url}`);
    }
    throw new Error(`échec après plusieurs tentatives — ${url}`);
  }

  // L'API search est limitée à ~10 requêtes/min sans jeton, ~30 avec.
  // On espace les appels nous-mêmes plutôt que de se faire jeter.
  let last = 0;
  async function searchCount(kind, q) {
    const gap = token ? 2200 : 7000;
    const since = Date.now() - last;
    if (since < gap) await new Promise((r) => setTimeout(r, gap - since));
    last = Date.now();
    const accept = kind === "commits" ? "application/vnd.github.cloak-preview+json" : undefined;
    const res = await gh(`/search/${kind}?q=${encodeURIComponent(q)}&per_page=1`, { accept });
    return res?.total_count ?? 0;
  }

  return { searchCount };
}

// Compteurs affichés dans le bandeau « Stats ».
//
// Tout passe par l'API search : une requête par compteur, et chaque chiffre
// correspond à une recherche GitHub que le badge rend cliquable. Les endpoints
// `/users/...` sont volontairement évités — ils imposent de paginer tous les
// dépôts pour un seul nombre.
//
// L'année d'arrivée sur GitHub ne change jamais : c'est une constante, pas un
// appel réseau.
export async function fetchStats({ user, orgs, token, since }) {
  const { searchCount } = client({ user, token });

  const orgFilter = orgs.map((o) => `org:${o}`).join(" ");
  const commits = await searchCount("commits", `author:${user}`);
  const orgCommits = orgs.length ? await searchCount("commits", `author:${user} ${orgFilter}`) : 0;
  const prs = await searchCount("issues", `author:${user} type:pr`);
  const merged = await searchCount("issues", `author:${user} type:pr is:merged`);
  const issues = await searchCount("issues", `author:${user} type:issue`);
  const repos = await searchCount("repositories", `user:${user} fork:false is:public`);

  if (commits === 0 && prs === 0 && repos === 0) {
    // Trois compteurs à zéro ne décrivent aucun compte réel : l'API a répondu
    // sans rien trouver. Mieux vaut échouer et garder l'instantané précédent.
    throw new Error("l'API search ne renvoie aucun résultat");
  }

  return {
    commits,
    prs,
    merged,
    issues,
    repos,
    orgShare: commits > 0 ? Math.round((orgCommits / commits) * 100) : 0,
    since,
    collected: new Date().toISOString(),
  };
}
