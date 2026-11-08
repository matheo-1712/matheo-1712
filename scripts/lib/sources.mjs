// Récupération des données, avec repli systématique sur l'instantané committé.
//
// Principe : une source qui ne répond pas ne doit jamais produire un README
// vide. Les fichiers de `data/` sont versionnés ; si le réseau, un quota ou
// une panne empêche la collecte, on republie les données de la veille.

import { readFile, writeFile } from "node:fs/promises";
import { parseYaml } from "./yaml-lite.mjs";

async function readLocal(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

// Télécharge `url`, garde une copie dans `cache`, et retombe sur cette copie
// si la requête échoue. `parse` doit lever si le contenu est inexploitable :
// mieux vaut l'instantané de la veille qu'une page d'erreur enregistrée.
async function fetchWithCache({ url, cache, parse, label }) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "matheo-1712-readme-builder" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const text = await res.text();
    const value = parse(text);
    await writeFile(cache, text);
    console.log(`${label} : récupéré depuis le portfolio`);
    return { value, fresh: true };
  } catch (err) {
    console.warn(`${label} : ${err.message} — repli sur ${cache}`);
    const text = await readLocal(cache);
    if (text === null) throw new Error(`${label} indisponible et aucun instantané dans ${cache}`);
    return { value: parse(text), fresh: false };
  }
}

export async function loadProjects({ url, cache }) {
  const { value, fresh } = await fetchWithCache({
    url,
    cache,
    label: "projets",
    parse: (text) => {
      const data = JSON.parse(text);
      if (!Array.isArray(data?.projects)) throw new Error("projects.json sans tableau `projects`");
      if (data.projects.length === 0) throw new Error("projects.json vide");
      return data;
    },
  });
  // `hidden` est posé par les overrides du portfolio : on le respecte ici aussi.
  const projects = value.projects.filter((p) => !p.hidden);
  return { projects, generated: value.generated ?? "", fresh };
}

export async function loadProfile({ url, cache }) {
  const { value } = await fetchWithCache({
    url,
    cache,
    label: "profil",
    parse: (text) => {
      const data = parseYaml(text);
      if (!data?.identity?.name) throw new Error("profile.yml sans identity.name");
      return data;
    },
  });
  return value;
}

// Les compteurs GitHub ont leur propre cache : un quota dépassé ne doit pas
// faire échouer la génération, ni réinitialiser les chiffres à zéro.
export async function loadStats({ collect, cache }) {
  try {
    const stats = await collect();
    await writeFile(cache, `${JSON.stringify(stats, null, 2)}\n`);
    console.log("stats : collectées depuis l'API GitHub");
    return { stats, fresh: true };
  } catch (err) {
    console.warn(`stats : ${err.message} — repli sur ${cache}`);
    const text = await readLocal(cache);
    if (text === null) throw new Error(`stats indisponibles et aucun instantané dans ${cache}`);
    return { stats: JSON.parse(text), fresh: false };
  }
}
