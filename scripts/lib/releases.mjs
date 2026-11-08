// Dernière version publiée de chaque projet, lue directement sur GitHub.
//
// data/projects.json porte bien une version, mais celle que le portfolio a vue
// lors de sa dernière collecte : une release publiée après coup n'apparaît
// qu'au passage suivant, soit jusqu'à un jour plus tard. On interroge donc
// GitHub ici, et on retombe sur la valeur du portfolio en cas d'échec.
//
// Bénéfice annexe : `published_at` donne la vraie date de sortie, que
// data/projects.json ne contient pas.

const API = "https://api.github.com";
const CONCURRENCY = 4;

function ownerRepo(url) {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url ?? "");
  return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}

async function latestRelease(fullName, headers) {
  const res = await fetch(`${API}/repos/${fullName}/releases/latest`, { headers });
  // 404 : aucune release publiée. Ce n'est pas une erreur.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${fullName}`);
  const r = await res.json();
  if (r.draft) return null;
  return { tag: r.tag_name ?? "", date: r.published_at ?? "", prerelease: Boolean(r.prerelease) };
}

// Renvoie une Map `owner/repo` -> { tag, date, prerelease }.
// Lève si AUCUN dépôt n'a pu être interrogé : l'appelant repart alors de
// l'instantané plutôt que d'effacer toutes les versions.
export async function fetchReleases(projects, { token } = {}) {
  const headers = {
    "User-Agent": "matheo-1712-readme-builder",
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const names = [...new Set(projects.map((p) => ownerRepo(p.links?.repo)).filter(Boolean))];
  const out = new Map();
  let failures = 0;

  const queue = [...names];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      try {
        const rel = await latestRelease(name, headers);
        if (rel) out.set(name.toLowerCase(), rel);
      } catch (err) {
        failures++;
        console.warn(`release : ${err.message}`);
      }
    }
  });
  await Promise.all(workers);

  if (names.length > 0 && failures === names.length) {
    throw new Error(`aucune release lisible (${failures} échecs)`);
  }
  return out;
}

// Applique les versions fraîches aux projets. La valeur du portfolio reste
// en place quand GitHub n'a rien renvoyé pour ce dépôt (dépôt privé, pas de
// release, appel en échec).
export function applyReleases(projects, releases) {
  let updated = 0;
  for (const p of projects) {
    const key = ownerRepo(p.links?.repo)?.toLowerCase();
    const rel = key ? releases.get(key) : null;
    if (!rel?.tag) continue;
    if (rel.tag !== p.version) updated++;
    p.version = rel.tag;
    p.prerelease = rel.prerelease;
    p.releaseDate = rel.date;
  }
  return updated;
}

export const serializeReleases = (releases) =>
  `${JSON.stringify(Object.fromEntries([...releases].sort()), null, 2)}\n`;

export const deserializeReleases = (text) => new Map(Object.entries(JSON.parse(text)));
