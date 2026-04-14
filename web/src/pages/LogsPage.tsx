import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import type { GitHubWorkflowRun } from "../api/types";

export default function LogsPage() {
  const client = useGitHub();
  const [runs, setRuns] = useState<GitHubWorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadRuns();
  }, [client]);

  function loadRuns() {
    if (!client) return;

    setLoading(true);
    client
      .listWorkflowRuns("daily-digest.yml")
      .then(setRuns)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }

  async function handleTrigger() {
    if (!client) return;

    setTriggering(true);
    setMessage("");
    try {
      await client.triggerWorkflow("daily-digest.yml");
      setMessage("已触发工作流，请稍后刷新查看结果。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">工作流日志</h2>
        <div className="flex gap-2">
          <button
            onClick={loadRuns}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1 rounded"
          >
            刷新
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {triggering ? "触发中..." : "手动触发"}
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${message.includes("已触发") ? "text-green-600" : "text-red-600"}`}
        >
          {message}
        </p>
      )}

      {runs.length === 0 && (
        <p className="text-gray-500">暂无工作流运行记录。</p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2">状态</th>
            <th className="pb-2">触发</th>
            <th className="pb-2">开始时间</th>
            <th className="pb-2">链接</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-100">
              <td className="py-2">
                <StatusBadge
                  status={run.status}
                  conclusion={run.conclusion}
                />
              </td>
              <td className="py-2 text-gray-600">{run.event}</td>
              <td className="py-2 text-gray-600">
                {run.run_started_at
                  ? new Date(run.run_started_at).toLocaleString("zh-CN")
                  : "-"}
              </td>
              <td className="py-2">
                <a
                  href={run.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  查看
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({
  status,
  conclusion,
}: {
  status: string | null;
  conclusion: string | null;
}) {
  if (status === "completed") {
    const color =
      conclusion === "success"
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700";
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${color}`}>
        {conclusion}
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
      {status ?? "unknown"}
    </span>
  );
}
