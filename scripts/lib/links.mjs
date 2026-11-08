// Vérification des liens affichés.
//
// Un lien mort sur un profil est pire que pas de lien : il donne l'impression
// que le projet tourne encore. Trois filtres, du moins cher au plus cher :
//
//   1. l'état de service relevé par le portfolio (`service.up`) ;
//   2. les doublons d'URL entre projets ;
//   3. une requête réelle sur ce qui reste.

const TIMEOUT_MS = 12_000;
const CONCURRENCY = 6;

// Un projet refait reprend souvent l'adresse de son prédécesseur. Le lien
// n'appartient alors qu'au projet le plus actuel : le montrer sur l'archive
// renverrait vers le successeur, ce qui est trompeur.
const STATUS_WEIGHT = { prod: 0, wip: 1, paused: 2, archived: 3 };

export function dropDuplicateLinks(projects) {
  const owner = new Map(); // url -> projet qui la garde
  for (const p of projects) {
    for (const [key, url] of Object.entries(p.links ?? {})) {
      if (key === "repo" || !url) continue;
      const best = owner.get(url);
      if (!best) {
        owner.set(url, p);
        continue;
      }
      const wa = STATUS_WEIGHT[p.status] ?? 9;
      const wb = STATUS_WEIGHT[best.status] ?? 9;
      const better = wa !== wb ? wa < wb : String(p.updated) > String(best.updated);
      if (better) owner.set(url, p);
    }
  }

  const dropped = [];
  for (const p of projects) {
    for (const [key, url] of Object.entries(p.links ?? {})) {
      if (key === "repo" || !url) continue;
      if (owner.get(url) !== p) {
        delete p.links[key];
        dropped.push({ project: p.key, url, keptBy: owner.get(url).key });
      }
    }
  }
  return dropped;
}

async function probe(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "matheo-1712-readme-builder" },
      });
      // 4xx/5xx : la page ne répond plus comme elle devrait.
      if (res.status < 400) return { ok: true, status: res.status };
      if (attempt === 1) return { ok: false, status: res.status };
    } catch (err) {
      if (attempt === 1) return { ok: false, status: 0, error: err.message };
    }
  }
  return { ok: false, status: 0 };
}

async function probeAll(urls) {
  const results = new Map();
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      results.set(url, await probe(url));
    }
  });
  await Promise.all(workers);
  return results;
}

// Retire les liens morts. Renvoie ce qui a été retiré, et pourquoi.
export async function pruneDeadLinks(projects) {
  const removed = [];

  // 1. Le portfolio surveille déjà les services qu'il connaît : un service
  //    qu'il donne pour éteint n'a pas besoin d'être retesté.
  for (const p of projects) {
    if (p.service && p.service.up === false && !p.service.uncertain) {
      for (const [key, url] of Object.entries(p.links ?? {})) {
        if (key === "repo" || !url) continue;
        delete p.links[key];
        removed.push({ project: p.key, url, reason: "service éteint (relevé du portfolio)" });
      }
    }
  }

  // 2. Doublons.
  for (const d of dropDuplicateLinks(projects)) {
    removed.push({ project: d.project, url: d.url, reason: `URL déjà portée par ${d.keptBy}` });
  }

  // 3. Requête réelle sur ce qui reste.
  const urls = new Set();
  for (const p of projects) {
    for (const [key, url] of Object.entries(p.links ?? {})) {
      if (key !== "repo" && url) urls.add(url);
    }
  }
  if (urls.size === 0) return { removed, checked: 0 };

  const results = await probeAll(urls);
  const failures = [...results.values()].filter((r) => !r.ok).length;

  // Garde-fou : si TOUT échoue, c'est le réseau de la machine qui est en
  // cause, pas les sites. On ne vide pas le README sur un incident local.
  if (failures === results.size && results.size > 1) {
    console.warn(`liens : les ${results.size} requêtes ont échoué — réseau suspect, aucun lien retiré`);
    return { removed, checked: results.size, inconclusive: true };
  }

  for (const p of projects) {
    for (const [key, url] of Object.entries(p.links ?? {})) {
      if (key === "repo" || !url) continue;
      const r = results.get(url);
      if (r && !r.ok) {
        delete p.links[key];
        removed.push({ project: p.key, url, reason: r.status ? `HTTP ${r.status}` : `injoignable (${r.error ?? "timeout"})` });
      }
    }
  }
  return { removed, checked: results.size };
}
