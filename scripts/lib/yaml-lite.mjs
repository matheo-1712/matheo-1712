// Lecteur YAML minimal, sans dépendance.
//
// Il ne couvre que ce que `data/profile.yml` du portfolio utilise :
//   - des mappings imbriqués  (identity: / name: "...")
//   - des listes de scalaires (- "TypeScript")
//   - des listes de mappings  (- group: "Backend" / items: [...])
//   - des tableaux en ligne   (["a", "b"])
//   - des blocs replies       (headline: > suivi de lignes indentées)
//
// Les mappings en ligne (`{ name: "x" }`) sont renvoyés tels quels, en texte :
// aucun champ lu ici n'en utilise. Pour tout le reste, `yaml` ferait mieux —
// mais une dépendance pour quatre champs ne se justifie pas.

// Retire le commentaire de fin de ligne sans toucher aux `#` entre guillemets
// (sinon `["C#"]` deviendrait `["C`).
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function tokenize(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw).replace(/\s+$/, "");
    if (!line.trim()) continue;
    out.push({ indent: line.length - line.trimStart().length, text: line.trim() });
  }
  return out;
}

// Position du `:` qui sépare la clé de la valeur, en ignorant les guillemets.
function colonAt(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ":" && (i + 1 === text.length || /[\s]/.test(text[i + 1]))) {
      return i;
    }
  }
  return -1;
}

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// Découpe `a, "b, c", d` sur les virgules de premier niveau.
function splitInline(body) {
  const parts = [];
  let buf = "";
  let quote = null;
  for (const c of body) {
    if (quote) {
      if (c === quote) quote = null;
      buf += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      buf += c;
    } else if (c === ",") {
      parts.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts.map(unquote).filter((v) => v !== "");
}

function scalar(raw) {
  const t = raw.trim();
  if (t.startsWith("[") && t.endsWith("]")) return splitInline(t.slice(1, -1));
  const v = unquote(t);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  return v;
}

// Les lignes d'un bloc replié : plus indentées que la clé qui l'introduit.
function folded(toks, start, indent, style) {
  const lines = [];
  let i = start;
  while (i < toks.length && toks[i].indent > indent) {
    lines.push(toks[i].text);
    i++;
  }
  return [style === "|" ? lines.join("\n") : lines.join(" "), i];
}

function parseMap(toks, start, indent) {
  const map = {};
  let i = start;
  while (i < toks.length && toks[i].indent === indent && !toks[i].text.startsWith("- ")) {
    const at = colonAt(toks[i].text);
    if (at === -1) break;
    const key = unquote(toks[i].text.slice(0, at));
    const rest = toks[i].text.slice(at + 1).trim();
    i++;
    if (rest === ">" || rest === "|" || rest === ">-" || rest === "|-") {
      const [value, next] = folded(toks, i, indent, rest[0]);
      map[key] = value;
      i = next;
    } else if (rest !== "") {
      map[key] = scalar(rest);
    } else if (i < toks.length && toks[i].indent > indent) {
      const [value, next] = parseNode(toks, i, toks[i].indent);
      map[key] = value;
      i = next;
    } else {
      map[key] = null;
    }
  }
  return [map, i];
}

function parseSeq(toks, start, indent) {
  const seq = [];
  let i = start;
  while (i < toks.length && toks[i].indent === indent && (toks[i].text === "-" || toks[i].text.startsWith("- "))) {
    const head = toks[i].text === "-" ? "" : toks[i].text.slice(2).trim();
    i++;
    // Les lignes du même élément, plus indentées que le tiret.
    const tail = [];
    while (i < toks.length && toks[i].indent > indent) {
      tail.push(toks[i]);
      i++;
    }
    if (head !== "" && colonAt(head) !== -1 && !head.startsWith("{")) {
      // `- group: "Backend"` : premier champ sur la ligne du tiret.
      const inner = [{ indent: indent + 2, text: head }, ...tail.map((t) => ({ ...t, indent: indent + 2 }))];
      seq.push(parseMap(inner, 0, indent + 2)[0]);
    } else if (head !== "") {
      seq.push(scalar(head));
    } else if (tail.length) {
      seq.push(parseNode(tail, 0, tail[0].indent)[0]);
    }
  }
  return [seq, i];
}

function parseNode(toks, start, indent) {
  if (start >= toks.length) return [null, start];
  const head = toks[start];
  if (head.text === "-" || head.text.startsWith("- ")) return parseSeq(toks, start, indent);
  return parseMap(toks, start, indent);
}

export function parseYaml(text) {
  const toks = tokenize(text);
  if (toks.length === 0) return {};
  return parseNode(toks, 0, toks[0].indent)[0] ?? {};
}
