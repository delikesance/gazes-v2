import { d as defineEventHandler, g as getQuery, V as VERIFIED_PROVIDERS, n as sortUrlsByProviderReliability, o as categorizeUrlsByReliability, q as getProviderStats } from '../../nitro/nitro.mjs';
import 'jsonwebtoken';
import 'bcryptjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import '@supabase/supabase-js';
import '@iconify/utils';
import 'consola';
import 'node:url';
import 'ipx';

const providers = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const action = query.action;
  switch (action) {
    case "list":
      return {
        providers: VERIFIED_PROVIDERS,
        stats: getProviderStats()
      };
    case "stats":
      return getProviderStats();
    case "test":
      const sampleUrls = [
        "https://www.myvi.top/embed/test123",
        "https://sendvid.com/embed/test456",
        "https://streamtape.com/embed/test789",
        "https://unknown-provider.com/test000"
      ];
      const categorized = categorizeUrlsByReliability(sampleUrls);
      const sorted = sortUrlsByProviderReliability(sampleUrls);
      return {
        originalUrls: sampleUrls,
        categorized,
        sorted,
        message: "Provider sorting test completed"
      };
    case "sort":
      const urls = Array.isArray(query.urls) ? query.urls : typeof query.urls === "string" ? [query.urls] : [];
      if (urls.length === 0) {
        return {
          error: "No URLs provided",
          message: "Use ?action=sort&urls[]=url1&urls[]=url2 or ?action=sort&urls=url1"
        };
      }
      const sortedUrls = sortUrlsByProviderReliability(urls);
      const categorizedUrls = categorizeUrlsByReliability(urls);
      return {
        originalUrls: urls,
        sortedUrls,
        categorizedUrls,
        message: `Sorted ${urls.length} URLs by provider reliability`
      };
    default:
      return {
        totalProviders: VERIFIED_PROVIDERS.length,
        verifiedProviders: VERIFIED_PROVIDERS.map((p) => ({
          hostname: p.hostname,
          reliability: p.reliability,
          description: p.description
        })),
        usage: {
          "List all providers": "?action=list",
          "Get statistics": "?action=stats",
          "Test sorting": "?action=test",
          "Sort URLs": "?action=sort&urls[]=url1&urls[]=url2"
        }
      };
  }
});

export { providers as default };
//# sourceMappingURL=providers.mjs.map
