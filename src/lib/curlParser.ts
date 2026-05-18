export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
}

export function parseCurl(input: string): ParsedCurl | null {
  // Join multiline backslash continuations
  const raw = input
    .replace(/\\\r\n/g, ' ')
    .replace(/\\\n/g, ' ')
    .trim();

  if (!/^curl\s/i.test(raw)) return null;

  // Method
  const methodMatch = raw.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
  let method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

  // URL — find first http(s):// occurrence (quoted or not)
  const urlMatch = raw.match(/['"]?(https?:\/\/[^'">\s]+)['"]?/);
  if (!urlMatch) return null;

  // Parse URL for clean base + query params
  let url = urlMatch[1];
  const queryParams: Record<string, string> = {};
  try {
    const u = new URL(urlMatch[1]);
    url = u.origin + u.pathname;
    u.searchParams.forEach((v, k) => { queryParams[k] = v; });
  } catch {
    // non-standard URL, keep as-is
  }

  // Headers  -H 'Key: Value'  or  --header "Key: Value"
  const headers: Record<string, string> = {};
  const hRe = /(?:-H|--header)\s+(?:'([^']*)'|"([^"]*)")/g;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(raw)) !== null) {
    const h = (hm[1] ?? hm[2]).trim();
    const sep = h.indexOf(':');
    if (sep > 0) {
      headers[h.slice(0, sep).trim()] = h.slice(sep + 1).trim();
    }
  }

  // Body  -d / --data / --data-raw / --data-binary
  let body = '';
  const bRe = /(?:-d|--data(?:-raw|-binary|-urlencode)?)\s+(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/;
  const bm = raw.match(bRe);
  if (bm) {
    body = (bm[1] ?? bm[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (method === 'GET') method = 'POST';
    // Pretty-print if JSON
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch { /* leave as-is */ }
  }

  return { method, url, headers, queryParams, body };
}
