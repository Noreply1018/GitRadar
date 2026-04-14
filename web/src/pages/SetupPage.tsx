import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { GitHubClient } from "../api/github";
import { useAuth } from "../hooks/useAuth";

export default function SetupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("GitRadar");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const client = new GitHubClient(token.trim(), owner.trim(), repo.trim());
      const valid = await client.validateToken();

      if (!valid) {
        setError("无法访问该仓库，请检查 Token 和仓库信息。");
        return;
      }

      login(token.trim(), owner.trim(), repo.trim());
      navigate("/");
    } catch {
      setError("验证失败，请检查网络连接。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4"
      >
        <h1 className="text-xl font-bold">GitRadar Console 设置</h1>
        <p className="text-sm text-gray-500">
          输入 GitHub PAT（需要 <code>repo</code> scope）和仓库信息。
        </p>

        <label className="block">
          <span className="text-sm font-medium">GitHub Token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="ghp_..."
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Owner（用户名或组织名）</span>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Repo</span>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "验证中..." : "连接"}
        </button>
      </form>
    </div>
  );
}
