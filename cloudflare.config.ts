import { bindings, defineConfig, defineWorker } from "cf/config";

// data.forthis.world on Cloudflare Workers, built by vinext. Every push to `main` builds and deploys it (Workers Builds).
// Pages are rendered by the Worker on each request (no cache); files in public/ and the built JS/CSS are served as static
// assets.
export default defineConfig({
  accountId: "621891d001f65c4e201a0d5dfc8372f6", // ForThisWorld
  worker: defineWorker({
    name: "data-ftw",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-17",
    // Served only on its own domain: no workers.dev or preview URLs.
    domains: ["data.forthis.world"],
    workersDev: false,
    previewUrls: false,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
