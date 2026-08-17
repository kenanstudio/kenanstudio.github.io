const GITHUB_OWNER = "kiananstudio";
const GITHUB_REPO = "kiananstudio.github.io";
const GITHUB_BRANCH = "main";
const CATALOG_PATH = "data/products.json";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${CATALOG_PATH}`;

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Bibika", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function githubHeaders(env) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Kianan-Studio-Bibika",
  };
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function validateCatalog(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.categories) || !Array.isArray(data.products)) {
    return "Некорректная структура каталога.";
  }

  const ids = new Set();
  for (const product of data.products) {
    if (!product || typeof product !== "object" || !String(product.id || "").trim() || !String(product.title || "").trim()) {
      return "У каждого продукта должны быть заполнены ID и название.";
    }
    if (ids.has(product.id)) return `Повторяющийся ID продукта: ${product.id}`;
    ids.add(product.id);
  }
  return null;
}

async function getGitHubCatalog(env) {
  const response = await fetch(`${GITHUB_API}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    method: "GET",
    headers: githubHeaders(env),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = JSON.parse(decodeBase64Utf8(payload.content));
  return { data, sha: payload.sha };
}

async function putGitHubCatalog(env, data, message) {
  const current = await getGitHubCatalog(env);
  const content = encodeBase64Utf8(`${JSON.stringify(data, null, 2)}\n`);

  const response = await fetch(GITHUB_API, {
    method: "PUT",
    headers: {
      ...githubHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      message: String(message || "Update website catalog from Bibika").slice(0, 120),
      content,
      sha: current.sha,
      branch: GITHUB_BRANCH,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function handleCatalogApi(request, env) {
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: "GitHub publishing is not configured." }, 503);
  }

  if (request.method === "GET") {
    try {
      const { data } = await getGitHubCatalog(env);
      return jsonResponse(data);
    } catch (error) {
      return jsonResponse({ error: `Не удалось загрузить каталог из GitHub: ${error.message}` }, 502);
    }
  }

  if (request.method === "POST" || request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Некорректный JSON." }, 400);
    }

    const errorMessage = validateCatalog(body?.data);
    if (errorMessage) return jsonResponse({ error: errorMessage }, 400);

    try {
      const result = await putGitHubCatalog(env, body.data, body.message);
      return jsonResponse({
        ok: true,
        commit: result.commit?.sha || null,
        url: result.commit?.html_url || null,
      });
    } catch (error) {
      const status = error.status === 409 ? 409 : 502;
      return jsonResponse({ error: `Не удалось опубликовать изменения в GitHub: ${error.message}` }, status);
    }
  }

  return jsonResponse({ error: "Method not allowed." }, 405);
}

async function handleRequest(request, env) {
  const expectedUser = env.BIBIKA_USER;
  const expectedPassword = env.BIBIKA_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new Response("Bibika authentication is not configured.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !authorization.startsWith("Basic ")) return unauthorized();

  let credentials;
  try {
    credentials = atob(authorization.slice(6));
  } catch {
    return unauthorized();
  }

  const separator = credentials.indexOf(":");
  if (separator < 0) return unauthorized();

  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  if (username !== expectedUser || password !== expectedPassword) return unauthorized();

  const url = new URL(request.url);
  if (url.pathname === "/api/catalog") {
    return handleCatalogApi(request, env);
  }

  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cache-Control", "no-store");

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    const html = await response.text();
    const hotfix = `<script>window.addEventListener("DOMContentLoaded",function(){try{publishData=function(nextState,message){return requestJson("/api/catalog",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:nextState,message:message})});};}catch(e){console.error("Bibika publish hotfix",e);}});</script>`;
    const patched = html.includes("</body>") ? html.replace("</body>", `${hotfix}</body>`) : `${html}${hotfix}`;
    return new Response(patched, { status: response.status, statusText: response.statusText, headers });
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return jsonResponse({ error: `Внутренняя ошибка Bibika Worker: ${error?.message || String(error)}` }, 500);
      }
      return new Response("Bibika Worker error", {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  },
};
