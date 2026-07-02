import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const PATHS = {
  dataGitHub: resolve(ROOT, "data", "github.json"),
  dataMedium: resolve(ROOT, "data", "medium.json"),
  templateDashboard: resolve(ROOT, "templates", "dashboard.svg"),
  templateBanner: resolve(ROOT, "templates", "banner.svg"),
  assetDashboard: resolve(ROOT, "assets", "dashboard.svg"),
  assetBanner: resolve(ROOT, "assets", "banner.svg"),
  assetFooter: resolve(ROOT, "assets", "footer.svg"),
  assetContributionGrid: resolve(ROOT, "assets", "contribution-grid.svg"),
  readme: resolve(ROOT, "README.md")
};

function readJson(path) {
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatInt(value) {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

function languageColor(index) {
  const palette = ["#38BDF8", "#7AA2F7", "#73DACA", "#F7768E", "#E0AF68", "#9ECE6A", "#BB9AF7", "#7DCFFF"];
  return palette[index % palette.length];
}

function createLanguageRows(languages) {
  if (!languages.length) {
    return `
      <text x="678" y="454" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="15">No language data available yet.</text>
    `;
  }

  return languages
    .map((language, index) => {
      const y = 452 + index * 31;
      const width = Math.max(12, Math.min(332, Math.round((Number(language.percentage) / 100) * 332)));
      const color = languageColor(index);

      return `
        <text x="678" y="${y}" fill="#CBD5E1" font-family="Segoe UI, Arial, sans-serif" font-size="14">${escapeXml(language.name)}</text>
        <rect x="866" y="${y - 11}" width="332" height="9" rx="5" fill="#1E293B" />
        <rect x="866" y="${y - 11}" width="${width}" height="9" rx="5" fill="${color}" />
        <text x="1200" y="${y}" text-anchor="end" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="13">${Number(language.percentage).toFixed(2)}%</text>
      `;
    })
    .join("\n");
}

function renderDashboard(githubData) {
  const template = readFileSync(PATHS.templateDashboard, "utf8");
  const stats = githubData.stats;

  const progressWidth = Math.max(42, Math.min(512, Math.round((stats.contributions / 2500) * 512)));

  return template
    .replace("{{FOLLOWERS}}", formatInt(stats.followers))
    .replace("{{REPOSITORIES}}", formatInt(stats.repositories))
    .replace("{{STARS}}", formatInt(stats.stars))
    .replace("{{FORKS}}", formatInt(stats.forks))
    .replace("{{CONTRIBUTIONS}}", formatInt(stats.contributions))
    .replace("{{COMMITS}}", formatInt(stats.commits))
    .replace("{{PULL_REQUESTS}}", formatInt(stats.pullRequests))
    .replace("{{ISSUES}}", formatInt(stats.issues))
    .replace("{{REPOSITORIES_CONTRIBUTED_TO}}", formatInt(stats.repositoriesContributedTo))
    .replace("{{CONTRIBUTION_PROGRESS_WIDTH}}", String(progressWidth))
    .replace("{{LANGUAGE_ROWS}}", createLanguageRows(githubData.topLanguages ?? []))
    .replace("{{LAST_UPDATED}}", escapeXml(githubData.lastUpdated));
}

function renderBanner(githubData) {
  const template = readFileSync(PATHS.templateBanner, "utf8");
  const topLanguage = githubData.topLanguages?.[0]?.name ?? "N/A";

  return template
    .replace("{{FOLLOWERS}}", formatInt(githubData.stats.followers))
    .replace("{{REPOSITORIES}}", formatInt(githubData.stats.repositories))
    .replace("{{STARS}}", formatInt(githubData.stats.stars))
    .replace("{{CONTRIBUTIONS}}", formatInt(githubData.stats.contributions))
    .replace("{{TOP_LANGUAGE}}", escapeXml(topLanguage));
}

function renderFooter(githubData) {
  const year = new Date().getUTCFullYear();

  return `<svg width="1280" height="110" viewBox="0 0 1280 110" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="footerBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1220"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="footerAccent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#73DACA"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="110" rx="20" fill="url(#footerBg)"/>
  <rect x="46" y="31" width="1188" height="2" rx="2" fill="url(#footerAccent)"/>
  <text x="48" y="70" fill="#CBD5E1" font-family="Segoe UI, Arial, sans-serif" font-size="16">Om Kadu | Engineer focused on backend systems, product thinking, and open-source craftsmanship.</text>
  <text x="48" y="92" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="13">Updated ${escapeXml(githubData.lastUpdated)} | Copyright ${year} Om Kadu</text>
</svg>`;
}

function renderContributionGrid(githubData) {
  const weeks = githubData.contributionCalendar?.weeks ?? [];
  const daySize = 13;
  const gap = 4;
  const startX = 120;
  const startY = 78;

  const cells = [];
  const labels = ["Mon", "Wed", "Fri"];

  if (!weeks.length) {
    return `<svg width="1280" height="210" viewBox="0 0 1280 210" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gridBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1220"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="210" rx="20" fill="url(#gridBg)"/>
  <text x="44" y="66" fill="#E2E8F0" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700">Contribution Graph</text>
  <text x="44" y="106" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="16">Contribution calendar data will appear after the next GraphQL update run.</text>
</svg>`;
  }

  weeks.slice(-53).forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const x = startX + weekIndex * (daySize + gap);
      const y = startY + day.weekday * (daySize + gap);
      const color = day.color || "#1E293B";
      const title = `${day.date}: ${day.contributionCount} contributions`;

      cells.push(`<rect x="${x}" y="${y}" width="${daySize}" height="${daySize}" rx="3" fill="${color}"><title>${title}</title></rect>`);
    });
  });

  const legendX = 1000;
  const legendY = 176;

  return `<svg width="1280" height="230" viewBox="0 0 1280 230" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gridBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1220"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="230" rx="20" fill="url(#gridBg)"/>
  <text x="44" y="56" fill="#E2E8F0" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700">Contribution Graph</text>
  <text x="44" y="82" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="15">Live 12-month contribution calendar from GitHub GraphQL.</text>

  <text x="70" y="113" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="12">${labels[0]}</text>
  <text x="70" y="147" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="12">${labels[1]}</text>
  <text x="70" y="181" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="12">${labels[2]}</text>

  ${cells.join("\n")}

  <text x="948" y="186" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="12">Less</text>
  <rect x="985" y="176" width="13" height="13" rx="3" fill="#1E293B"/>
  <rect x="1004" y="176" width="13" height="13" rx="3" fill="#0E4429"/>
  <rect x="1023" y="176" width="13" height="13" rx="3" fill="#006D32"/>
  <rect x="1042" y="176" width="13" height="13" rx="3" fill="#26A641"/>
  <rect x="1061" y="176" width="13" height="13" rx="3" fill="#39D353"/>
  <text x="1082" y="186" fill="#94A3B8" font-family="Segoe UI, Arial, sans-serif" font-size="12">More</text>

  <text x="44" y="206" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="13">Total contributions: ${formatInt(githubData.stats.contributions)}</text>
</svg>`;
}

function renderMediumSection(mediumData) {
  const articles = mediumData?.articles ?? [];

  if (!articles.length) {
    return "No recent Medium articles found.";
  }

  return articles
    .map((article) => {
      const title = escapeXml(article.title);
      const summary = escapeXml(article.summary || "Read the latest write-up.");
      const date = escapeXml(article.publishedDate || "Recent");
      const mins = Number(article.readingMinutes || 1);
      const url = article.url;

      return `- <a href="${url}"><strong>${title}</strong></a><br/>${summary}<br/><sub>${date} • ${mins} min read</sub>`;
    })
    .join("\n");
}

function updateReadmeMediumSection(mediumData) {
  if (!existsSync(PATHS.readme)) {
    return;
  }

  const readme = readFileSync(PATHS.readme, "utf8");
  const startMarker = "<!-- MEDIUM:START -->";
  const endMarker = "<!-- MEDIUM:END -->";

  if (!readme.includes(startMarker) || !readme.includes(endMarker)) {
    return;
  }

  const replacement = `${startMarker}\n${renderMediumSection(mediumData)}\n${endMarker}`;
  const next = readme.replace(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "m"), replacement);
  writeFileSync(PATHS.readme, next, "utf8");
}

function ensureAssetsDirectory() {
  mkdirSync(resolve(ROOT, "assets"), { recursive: true });
}

function seedFallbackDataIfNeeded() {
  if (!existsSync(PATHS.dataMedium)) {
    mkdirSync(resolve(ROOT, "data"), { recursive: true });
    writeFileSync(
      PATHS.dataMedium,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: "https://medium.com/feed/@kaduom444",
          articles: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }
}

function main() {
  seedFallbackDataIfNeeded();

  const githubData = readJson(PATHS.dataGitHub);
  const mediumData = readJson(PATHS.dataMedium);

  if (!githubData) {
    throw new Error("Missing data/github.json. Run: npm run fetch:github");
  }

  ensureAssetsDirectory();

  writeFileSync(PATHS.assetDashboard, renderDashboard(githubData), "utf8");
  writeFileSync(PATHS.assetBanner, renderBanner(githubData), "utf8");
  writeFileSync(PATHS.assetFooter, renderFooter(githubData), "utf8");
  writeFileSync(PATHS.assetContributionGrid, renderContributionGrid(githubData), "utf8");

  updateReadmeMediumSection(mediumData);

  console.log("SVG assets rendered at assets/dashboard.svg, assets/banner.svg, assets/footer.svg, assets/contribution-grid.svg");
}

main();
