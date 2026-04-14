import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import { NotFoundError } from "../api/github";
import type { GitHubDirectoryEntry } from "../api/types";

type FeedbackAction = "like" | "bookmark" | "not_interested";

interface FeedbackEntry {
  repo: string;
  action: FeedbackAction;
  updatedAt: string;
}

interface FeedbackFile {
  date: string;
  items: FeedbackEntry[];
}

interface DigestItem {
  repo: string;
  url: string;
  theme: string;
  summary: string;
}

export default function FeedbackPage() {
  const client = useGitHub();
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [digestItems, setDigestItems] = useState<DigestItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [feedbackSha, setFeedbackSha] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    client
      .listDirectory("data/history")
      .then((items: GitHubDirectoryEntry[]) =>
        setDates(
          items
            .filter((item) => item.name.endsWith(".json"))
            .map((item) => item.name.replace(".json", ""))
            .sort((a, b) => b.localeCompare(a)),
        ),
      )
      .catch(() => setDates([]))
      .finally(() => setLoading(false));
  }, [client]);

  async function loadDate(date: string) {
    if (!client) return;

    setSelectedDate(date);

    const archiveRes = await client.readFile(`data/history/${date}.json`);
    const archive = JSON.parse(archiveRes.content) as {
      digest: { items: DigestItem[] };
    };
    setDigestItems(archive.digest.items);

    try {
      const fbRes = await client.readFile(`data/feedback/${date}.json`);
      const fbData = JSON.parse(fbRes.content) as FeedbackFile;
      setFeedback(fbData.items);
      setFeedbackSha(fbRes.sha);
    } catch (err) {
      if (err instanceof NotFoundError) {
        setFeedback([]);
        setFeedbackSha(undefined);
      }
    }
  }

  async function toggleFeedback(repo: string, action: FeedbackAction) {
    if (!client || !selectedDate) return;

    setSaving(true);

    const existing = feedback.find((f) => f.repo === repo);
    let updated: FeedbackEntry[];

    if (existing?.action === action) {
      updated = feedback.filter((f) => f.repo !== repo);
    } else {
      const entry: FeedbackEntry = {
        repo,
        action,
        updatedAt: new Date().toISOString(),
      };
      updated = [...feedback.filter((f) => f.repo !== repo), entry];
    }

    const fileContent: FeedbackFile = { date: selectedDate, items: updated };
    const content = JSON.stringify(fileContent, null, 2) + "\n";

    try {
      await client.writeFile(
        `data/feedback/${selectedDate}.json`,
        content,
        `chore(console): update feedback for ${selectedDate}`,
        feedbackSha,
      );
      const res = await client.readFile(`data/feedback/${selectedDate}.json`);
      setFeedbackSha(res.sha);
      setFeedback(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function getAction(repo: string): FeedbackAction | null {
    return feedback.find((f) => f.repo === repo)?.action ?? null;
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-semibold">反馈</h2>

      <select
        value={selectedDate ?? ""}
        onChange={(e) => e.target.value && loadDate(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm"
      >
        <option value="">选择日期</option>
        {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {selectedDate && digestItems.length === 0 && (
        <p className="text-gray-500">该日期暂无日报条目。</p>
      )}

      {digestItems.map((item) => {
        const current = getAction(item.repo);

        return (
          <div
            key={item.repo}
            className="bg-white border border-gray-200 rounded p-4 space-y-2"
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

            <div className="flex gap-2 pt-1">
              <FeedbackButton
                active={current === "like"}
                disabled={saving}
                onClick={() => toggleFeedback(item.repo, "like")}
                label="👍 赞"
              />
              <FeedbackButton
                active={current === "bookmark"}
                disabled={saving}
                onClick={() => toggleFeedback(item.repo, "bookmark")}
                label="⭐ 收藏"
              />
              <FeedbackButton
                active={current === "not_interested"}
                disabled={saving}
                onClick={() => toggleFeedback(item.repo, "not_interested")}
                label="👎 不感兴趣"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-1 rounded border ${
        active
          ? "bg-blue-100 border-blue-300 text-blue-700"
          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
      } disabled:opacity-50`}
    >
      {label}
    </button>
  );
}
