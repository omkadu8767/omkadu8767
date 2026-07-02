import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const OUTPUT_PATH = resolve(ROOT, "data", "github.json");
const ENDPOINT = "https://api.github.com/graphql";
const USERNAME = "omkadu8767";

const PROFILE_QUERY = `
query Profile($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    name
    login
    avatarUrl
    bio
    url
    followers {
      totalCount
    }
    following {
      totalCount
    }
    repositories(ownerAffiliations: OWNER) {
      totalCount
    }
    pullRequests {
      totalCount
    }
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
            color
          }
        }
      }
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
    }
  }
}
`;

const REPOSITORIES_QUERY = `
query Repositories($login: String!, $after: String) {
  user(login: $login) {
    repositories(
      first: 100
      after: $after
      ownerAffiliations: OWNER
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        name
        isFork
        stargazerCount
        forkCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges {
            size
            node {
              name
            }
          }
        }
      }
    }
  }
}
`;

async function graphqlRequest(query, variables) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN is missing. Add it in repository secrets or local .env file.");
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "omkadu8767-profile-dashboard"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub GraphQL request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors, null, 2)}`);
  }

  return payload.data;
}

async function getAllRepositories(login) {
  const repositories = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await graphqlRequest(REPOSITORIES_QUERY, { login, after });
    const page = data.user.repositories;

    repositories.push(...page.nodes);
    after = page.pageInfo.endCursor;
    hasNextPage = page.pageInfo.hasNextPage;
  }

  return repositories;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(date);
}

function buildLanguageStats(repositories) {
  const languageBytes = new Map();

  for (const repo of repositories) {
    if (repo.isFork) {
      continue;
    }

    for (const edge of repo.languages.edges) {
      const current = languageBytes.get(edge.node.name) ?? 0;
      languageBytes.set(edge.node.name, current + edge.size);
    }
  }

  const totalBytes = [...languageBytes.values()].reduce((sum, value) => sum + value, 0);

  return [...languageBytes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes ? Number(((bytes / totalBytes) * 100).toFixed(2)) : 0
    }));
}

function ensureOutputDirectory() {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
}

async function main() {
  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  const profileData = await graphqlRequest(PROFILE_QUERY, {
    login: USERNAME,
    from: from.toISOString(),
    to: now.toISOString()
  });

  const repositories = await getAllRepositories(USERNAME);
  const ownedNonForkRepos = repositories.filter((repo) => !repo.isFork);

  const stars = ownedNonForkRepos.reduce((sum, repo) => sum + repo.stargazerCount, 0);
  const forks = ownedNonForkRepos.reduce((sum, repo) => sum + repo.forkCount, 0);
  const topLanguages = buildLanguageStats(repositories);

  const user = profileData.user;
  const contributions = user.contributionsCollection;

  const payload = {
    generatedAt: now.toISOString(),
    lastUpdated: formatDate(now),
    profile: {
      name: user.name,
      username: user.login,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      url: user.url
    },
    stats: {
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      repositories: user.repositories.totalCount,
      repositoriesOwned: ownedNonForkRepos.length,
      stars,
      forks,
      contributions: contributions.contributionCalendar.totalContributions,
      commits: contributions.totalCommitContributions,
      pullRequests: contributions.totalPullRequestContributions,
      pullRequestsLifetime: user.pullRequests.totalCount,
      issues: contributions.totalIssueContributions,
      repositoriesContributedTo: contributions.totalRepositoryContributions
    },
    contributionCalendar: contributions.contributionCalendar,
    topLanguages
  };

  ensureOutputDirectory();
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("GitHub dashboard data generated at data/github.json");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});