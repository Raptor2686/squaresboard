import { Capacitor, CapacitorHttp } from "@capacitor/core";

/**
 * Intercepts window.fetch on native platforms (Android / iOS)
 * to route all external API network requests through CapacitorHttp.
 *
 * This completely eliminates:
 * 1. WebView CORS issues (native HTTP has no browser CORS restrictions)
 * 2. Mobile cookie / header blocking
 * 3. Schema / origin mismatch issues
 */
export function initNativeHttpBridge() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input && typeof (input as Request).url === "string") {
        url = (input as Request).url;
      }

      // Only intercept external HTTP/HTTPS calls (not local asset / blob / data URLs)
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const token = localStorage.getItem("sb_token");
        const headers: Record<string, string> = {};

        // Copy incoming headers
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((v, k) => {
              headers[k] = v;
            });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([k, v]) => {
              headers[k] = v;
            });
          } else {
            Object.assign(headers, init.headers);
          }
        }

        // Attach authentication tokens
        if (token && !headers["Authorization"]) {
          headers["Authorization"] = `Bearer ${token}`;
          headers["X-Session-Token"] = token;
        }

        // Parse body if JSON
        let data: any = undefined;
        if (init?.body) {
          if (typeof init.body === "string") {
            try {
              data = JSON.parse(init.body);
            } catch {
              data = init.body;
            }
          } else {
            data = init.body;
          }
        }

        const method = (init?.method || "GET").toUpperCase();

        const res = await CapacitorHttp.request({
          url,
          method,
          headers,
          data,
        });

        // Convert response data to string/stream format expected by Response
        const bodyStr =
          typeof res.data === "string"
            ? res.data
            : res.data !== undefined && res.data !== null
            ? JSON.stringify(res.data)
            : "";

        return new Response(bodyStr, {
          status: res.status,
          statusText: res.status >= 200 && res.status < 300 ? "OK" : "Error",
          headers: new Headers(res.headers as Record<string, string>),
        });
      }
    } catch (e) {
      console.warn("[nativeHttpBridge] Failed, falling back to WebView fetch:", e);
    }

    return originalFetch(input, init);
  };
}
