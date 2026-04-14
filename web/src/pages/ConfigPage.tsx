import { useEffect, useState, type FormEvent } from "react";
import { useGitHub } from "../hooks/useGitHub";

interface ScheduleConfig {
  timezone: string;
  dailySendTime: string;
}

interface ThemeEntry {
  theme: string;
  keywords: string[];
}

interface DigestRulesConfig {
  version: string;
  themes: ThemeEntry[];
  blacklists: {
    descriptionKeywords: string[];
    readmeKeywords: string[];
    topics: string[];
  };
  selection: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  weights: Record<string, unknown>;
}

export default function ConfigPage() {
  const client = useGitHub();
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [scheduleSha, setScheduleSha] = useState("");
  const [rules, setRules] = useState<DigestRulesConfig | null>(null);
  const [rulesSha, setRulesSha] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    Promise.all([
      client.readFile("config/schedule.json"),
      client.readFile("config/digest-rules.json"),
    ])
      .then(([scheduleRes, rulesRes]) => {
        setSchedule(JSON.parse(scheduleRes.content) as ScheduleConfig);
        setScheduleSha(scheduleRes.sha);
        setRules(JSON.parse(rulesRes.content) as DigestRulesConfig);
        setRulesSha(rulesRes.sha);
      })
      .catch((err) =>
        setMessage(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, [client]);

  async function saveSchedule(e: FormEvent) {
    e.preventDefault();
    if (!client || !schedule) return;

    setSaving(true);
    setMessage("");
    try {
      await client.writeFile(
        "config/schedule.json",
        JSON.stringify(schedule, null, 2) + "\n",
        "chore(console): update schedule.json",
        scheduleSha,
      );
      const updated = await client.readFile("config/schedule.json");
      setScheduleSha(updated.sha);
      setMessage("调度配置已保存。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveRules(e: FormEvent) {
    e.preventDefault();
    if (!client || !rules) return;

    setSaving(true);
    setMessage("");
    try {
      await client.writeFile(
        "config/digest-rules.json",
        JSON.stringify(rules, null, 2) + "\n",
        "chore(console): update digest-rules.json",
        rulesSha,
      );
      const updated = await client.readFile("config/digest-rules.json");
      setRulesSha(updated.sha);
      setMessage("规则配置已保存。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-xl font-semibold">配置</h2>

      {message && (
        <p
          className={`text-sm ${message.includes("已保存") ? "text-green-600" : "text-red-600"}`}
        >
          {message}
        </p>
      )}

      {schedule && (
        <form onSubmit={saveSchedule} className="space-y-4">
          <h3 className="text-lg font-medium">调度设置</h3>

          <label className="block">
            <span className="text-sm font-medium">发送时间</span>
            <input
              type="time"
              value={schedule.dailySendTime}
              onChange={(e) =>
                setSchedule({ ...schedule, dailySendTime: e.target.value })
              }
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">时区</span>
            <input
              type="text"
              value={schedule.timezone}
              onChange={(e) =>
                setSchedule({ ...schedule, timezone: e.target.value })
              }
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存调度设置"}
          </button>
        </form>
      )}

      {rules && (
        <form onSubmit={saveRules} className="space-y-4">
          <h3 className="text-lg font-medium">主题配置</h3>

          {rules.themes.map((theme, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={theme.theme}
                  onChange={(e) => {
                    const updated = [...rules.themes];
                    updated[index] = { ...theme, theme: e.target.value };
                    setRules({ ...rules, themes: updated });
                  }}
                  className="font-medium text-sm border border-gray-300 rounded px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = rules.themes.filter((_, i) => i !== index);
                    setRules({ ...rules, themes: updated });
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  删除主题
                </button>
              </div>

              <textarea
                value={theme.keywords.join(", ")}
                onChange={(e) => {
                  const updated = [...rules.themes];
                  updated[index] = {
                    ...theme,
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  };
                  setRules({ ...rules, themes: updated });
                }}
                rows={2}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                placeholder="关键词，用逗号分隔"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setRules({
                ...rules,
                themes: [...rules.themes, { theme: "New Theme", keywords: [] }],
              })
            }
            className="text-sm text-blue-600 hover:underline"
          >
            + 添加主题
          </button>

          <h3 className="text-lg font-medium mt-6">黑名单</h3>

          <label className="block">
            <span className="text-sm font-medium">Description 黑名单</span>
            <textarea
              value={rules.blacklists.descriptionKeywords.join(", ")}
              onChange={(e) =>
                setRules({
                  ...rules,
                  blacklists: {
                    ...rules.blacklists,
                    descriptionKeywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">README 黑名单</span>
            <textarea
              value={rules.blacklists.readmeKeywords.join(", ")}
              onChange={(e) =>
                setRules({
                  ...rules,
                  blacklists: {
                    ...rules.blacklists,
                    readmeKeywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Topics 黑名单</span>
            <textarea
              value={rules.blacklists.topics.join(", ")}
              onChange={(e) =>
                setRules({
                  ...rules,
                  blacklists: {
                    ...rules.blacklists,
                    topics: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存规则配置"}
          </button>
        </form>
      )}
    </div>
  );
}
