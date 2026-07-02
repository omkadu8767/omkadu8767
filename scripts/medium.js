import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const OUTPUT_PATH = resolve(ROOT, "data", "medium.json");
const FEED_URL = "https://medium.com/feed/@kaduom444";
const ARTICLE_LIMIT = 4;

function stripHtml(input) {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadingMinutes(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return minutes;
}

function formatDate(isoLike) {
  const date = new Date(isoLike);
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function ensureOutputDirectory() {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
}

async function main() {
  const response = await fetch(FEED_URL, {
    headers: {
      "User-Agent": "omkadu8767-profile-dashboard"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Medium RSS (${response.status}).`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    parseTagValue: true
  });

  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item;

  if (!rawItems) {
    throw new Error("Unable to parse Medium RSS feed items.");
  }

  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const articles = items.slice(0, ARTICLE_LIMIT).map((item) => {
    const description = stripHtml(String(item.description ?? ""));
    const summary = description.length > 160 ? `${description.slice(0, 157)}...` : description;

    return {
      title: String(item.title ?? "Untitled"),
      url: String(item.link ?? "https://medium.com/@kaduom444"),
      publishedAt: String(item.pubDate ?? new Date().toUTCString()),
      publishedDate: formatDate(String(item.pubDate ?? new Date().toUTCString())),
      readingMinutes: estimateReadingMinutes(description),
      summary
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    source: FEED_URL,
    articles
  };

  ensureOutputDirectory();
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log("Medium articles generated at data/medium.json");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
