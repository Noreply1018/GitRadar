import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import { NotFoundError } from "../api/github";
import type { GitHubDirectoryEntry } from "../api/types";

interface DigestItem {
  repo: string;
  url: string;
  theme: string;
  summary: string;
  whyItMatters: string;
  evidence: string[];
}

interface ArchiveOverview {
  generatedAt: string;
  candidateCount: number;
  shortlistedCount: number;
  generationMeta: { llmCandidateCount: number; rulesVersion: string };
  digest: { items: DigestItem[] };
}

export default function HistoryPage() {
  const client = useGitHub();
  const [entries, setEntries] = useState<GitHubDirectoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    client
      .listDirectory("data/history")
      .then((items) => {
        const jsonFiles = items
          .filter((item) => item.name.endsWith(".json"))
          .sort((a, b) => b.name.localeCompare(a.name));
        setEntries(jsonFiles);
      })
      .catch((err) => {
        if (err instanceof NotFoundError) {
          setEntries([]);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => setLoading(false));
  }, [client]);

  function handleSelect(name: string) {
    if (!client) return;

    const date = name.replace(".json", "");

    if (selectedDate === date) {
      setSelectedDate(null);
      setDetail(null);
      return;
    }

    setSelectedDate(date);
    setDetailLoading(true);
    client
      .readFile(`data/history/${name}`)
      .then(({ content }) => setDetail(JSON.parse(content) as ArchiveOverview))
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setDetailLoading(false));
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">历史日报</h2>

      {entries.length === 0 && (
        <p className="text-gray-500">暂无历史日报。</p>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => {
          const date = entry.name.replace(".json", "");
          const isSelected = selectedDate === date;

          return (
            <li key={entry.name}>
              <button
                onClick={() => handleSelect(entry.name)}
                className={`w-full text-left px-4 py-3 rounded border text-sm ${
                  isSelected
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                {date}
              </button>

              {isSelected && detailLoading && (
                <p className="text-gray-500 text-sm mt-2 px-4">加载中...</p>
              )}

              {isSelected && detail && (
                <div className="mt-2 px-4 space-y-3">
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>候选 {detail.candidateCount}</span>
                    <span>入围 {detail.shortlistedCount}</span>
                    <span>
                      LLM 候选 {detail.generationMeta.llmCandidateCount}
                    </span>
                    <span>规则 {detail.generationMeta.rulesVersion}</span>
                  </div>

                  {detail.digest.items.map((item) => (
                    <div
                      key={item.repo}
                      className="bg-white border border-gray-200 rounded p-3 space-y-1"
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {item.repo}
                      </a>
                      <p className="text-xs text-gray-500">{item.theme}</p>
                      <p className="text-sm">{item.summary}</p>
                      <p className="text-xs text-gray-600">
                        {item.evidence.join("；")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
