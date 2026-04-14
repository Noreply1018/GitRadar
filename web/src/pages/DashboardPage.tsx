import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import { NotFoundError } from "../api/github";

interface RuntimeState {
  source: string;
  workflowName: string;
  trigger: string;
  lastRunAt: string;
  lastRunStatus: string;
  lastArchiveDate: string;
  runUrl: string;
  ref: string;
}

export default function DashboardPage() {
  const client = useGitHub();
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    client
      .readFile("data/runtime/github-runtime.json")
      .then(({ content }) => setRuntime(JSON.parse(content) as RuntimeState))
      .catch((err) => {
        if (err instanceof NotFoundError) {
          setRuntime(null);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => setLoading(false));
  }, [client]);

  if (loading) return <p className="text-gray-500">加载中...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!runtime) return <p className="text-gray-500">暂无运行记录。</p>;

  const statusColor =
    runtime.lastRunStatus === "success" ? "text-green-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 gap-4">
        <Card label="运行状态">
          <span className={`font-medium ${statusColor}`}>
            {runtime.lastRunStatus}
          </span>
        </Card>
        <Card label="最近运行">
          {new Date(runtime.lastRunAt).toLocaleString("zh-CN")}
        </Card>
        <Card label="最新归档">{runtime.lastArchiveDate}</Card>
        <Card label="触发方式">{runtime.trigger}</Card>
      </div>

      <a
        href={runtime.runUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        查看 GitHub Actions 日志
      </a>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}
