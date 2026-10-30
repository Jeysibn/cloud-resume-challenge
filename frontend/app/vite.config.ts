import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import canonicalContent from "../../content/portfolio.json" with { type: "json" };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function canonicalMetadataPlugin() {
  const name = escapeHtml(canonicalContent.profile.name);
  const role = escapeHtml(canonicalContent.profile.role);
  const portfolio = escapeHtml(canonicalContent.profile.portfolio);
  const github = escapeHtml(canonicalContent.profile.github);
  const linkedin = escapeHtml(canonicalContent.profile.linkedin);
  const jsonName = JSON.stringify(canonicalContent.profile.name);
  const jsonRole = JSON.stringify(canonicalContent.profile.role);
  const jsonPortfolio = JSON.stringify(canonicalContent.profile.portfolio);
  const jsonGithub = JSON.stringify(canonicalContent.profile.github);
  const jsonLinkedin = JSON.stringify(canonicalContent.profile.linkedin);

  return {
    name: "canonical-portfolio-metadata",
    transformIndexHtml(html: string) {
      return html
        .replaceAll("__PORTFOLIO_JSON_NAME__", jsonName)
        .replaceAll("__PORTFOLIO_JSON_ROLE__", jsonRole)
        .replaceAll("__PORTFOLIO_JSON_URL__", jsonPortfolio)
        .replaceAll("__PORTFOLIO_JSON_GITHUB__", jsonGithub)
        .replaceAll("__PORTFOLIO_JSON_LINKEDIN__", jsonLinkedin)
        .replaceAll("__PORTFOLIO_NAME__", name)
        .replaceAll("__PORTFOLIO_ROLE__", role)
        .replaceAll("__PORTFOLIO_URL__", portfolio)
        .replaceAll("__PORTFOLIO_GITHUB__", github)
        .replaceAll("__PORTFOLIO_LINKEDIN__", linkedin);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), canonicalMetadataPlugin()],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: "dist",
    // No source-map upload or private monitoring consumer exists in this
    // repository; avoid publishing source maps with the Pages artifact.
    sourcemap: false,
  },
});
