type RouteProvider = () => string | Promise<string>;

const slowRequestMs = 200;

function safeRoute(route: string) {
  return route
    .split("/")
    .map((segment) => (/^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ? "[id]" : segment))
    .join("/");
}

function getQueryName(input: RequestInfo | URL) {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const pathname = new URL(rawUrl).pathname;
  const restMatch = pathname.match(/\/rest\/v1\/([^/]+)/);
  if (restMatch) {
    const resource = restMatch[1] === "rpc"
      ? `rpc.${pathname.split("/")[4] ?? "unknown"}`
      : restMatch[1];
    const method = input instanceof Request ? input.method : "GET";
    return `${method.toUpperCase()} ${resource}`;
  }

  if (pathname.includes("/auth/v1/")) return `auth.${pathname.split("/").pop() ?? "request"}`;
  if (pathname.includes("/storage/v1/")) {
    const operation = pathname.includes("/object/") ? "object" : pathname.split("/").pop();
    return `storage.${operation ?? "request"}`;
  }
  if (pathname.includes("/functions/v1/")) return `function.${pathname.split("/").pop() ?? "request"}`;
  return "supabase.request";
}

function getMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  return input instanceof Request ? input.method.toUpperCase() : "GET";
}

export function createTimedSupabaseFetch(getRoute: RouteProvider): typeof fetch {
  return async (input, init) => {
    const route = safeRoute(await getRoute());
    const query = getQueryName(input);
    const startedAt = performance.now();
    let status = "network_error";

    try {
      const response = await fetch(input, init);
      status = String(response.status);
      return response;
    } finally {
      const durationMs = Math.round(performance.now() - startedAt);
      console.log(
        `[supabase-timing] route=${route} query=${getMethod(input, init)} ${query.replace(/^[A-Z]+ /, "")} duration_ms=${durationMs} status=${status}${durationMs > slowRequestMs ? " SLOW" : ""}`
      );
    }
  };
}

export function logTiming(route: string, query: string, startedAt: number) {
  const durationMs = Math.round(performance.now() - startedAt);
  console.log(
    `[supabase-timing] route=${safeRoute(route)} query=${query} duration_ms=${durationMs}${durationMs > slowRequestMs ? " SLOW" : ""}`
  );
}

export async function measureTiming<T>(route: string, query: string, operation: () => Promise<T>) {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    logTiming(route, query, startedAt);
  }
}

export function sanitizeTimingRoute(route: string) {
  return safeRoute(route);
}
