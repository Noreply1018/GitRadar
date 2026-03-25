const REPOSITORY_HEADING_REGEX =
  /<h2[^>]*>\s*<a[^>]*href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/g;

export async function fetchTrendingRepositoryNames(
  trendingUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const response = await fetcher(trendingUrl, {
    headers: {
      "user-agent": "GitRadar",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub Trending request failed with status ${response.status}.`,
    );
  }

  const html = await response.text();
  return parseTrendingRepositoryNames(html);
}

export function parseTrendingRepositoryNames(html: string): string[] {
  const repositoryNames = new Set<string>();

  for (const match of html.matchAll(REPOSITORY_HEADING_REGEX)) {
    repositoryNames.add(match[1]);
  }

  return Array.from(repositoryNames);
}
