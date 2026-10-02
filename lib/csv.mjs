export function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const delimiter = text.split(/\r?\n/)[0].includes(';') ? ';' : ',';
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else throw new Error('Aspas inválidas no CSV.');
    } else if (!quoted && (c === delimiter || c === '\n' || c === '\r')) {
      row.push(field.trim()); field = '';
      if (c !== delimiter) {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else field += c;
  }
  if (quoted) throw new Error('Campo com aspas não fechado.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('O CSV precisa de cabeçalho e pelo menos uma linha.');
  const headers = rows.shift().map(h => h.toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('Cabeçalhos duplicados.');
  return rows.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`Linha ${i + 2}: número de colunas incorreto.`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
export function repositories(text) {
  const seen = new Set();
  const result = parseCSV(text).map(row => {
    let name = row.full_name || row.repository || (row.owner && row.repo ? `${row.owner}/${row.repo}` : row.repo);
    name = String(name || '').replace(/^https:\/\/github\.com\//, '').replace(/\.git\/?$/, '').replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) throw new Error(`Repositório inválido: ${name || '(vazio)'}. Use owner/repo.`);
    return { full_name: name, default_branch: row.default_branch || '' };
  }).filter(r => { const key = r.full_name.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  if (result.length > 1000) throw new Error('Limite de 1.000 repositórios por coleta.');
  return result;
}
export function toCSV(rows, headers = Object.keys(rows[0] || {})) {
  const escape = v => { let s = v == null ? '' : String(v); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  return '\uFEFF' + [headers, ...rows.map(r => headers.map(h => r[h]))].map(r => r.map(escape).join(',')).join('\r\n');
}
