// Redeploy trigger after configuring Cloudflare secrets.
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

export default {
  async fetch(request, env) {
    const expectedUser = env.BIBIKA_USER;
    const expectedPassword = env.BIBIKA_PASSWORD;

    // Fail closed if the Cloudflare secrets have not been configured yet.
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
    if (!authorization || !authorization.startsWith("Basic ")) {
      return unauthorized();
    }

    let credentials;
    try {
      credentials = atob(authorization.slice(6));
    } catch {
      return unauthorized();
    }

    const separator = credentials.indexOf(":");
    if (separator < 0) {
      return unauthorized();
    }

    const username = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);

    if (username !== expectedUser || password !== expectedPassword) {
      return unauthorized();
    }

    return env.ASSETS.fetch(request);
  },
};
