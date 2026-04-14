import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";

export default function CallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const session = searchParams.get("session");

    if (!session) {
      setError("登录失败：未收到有效的会话凭证。");
      return;
    }

    login(session);
    navigate("/", { replace: true });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4">
          <h1 className="text-xl font-bold text-red-600">登录失败</h1>
          <p className="text-sm text-gray-600">{error}</p>
          <a
            href="/GitRadar/setup"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            返回登录页
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">正在登录...</p>
    </div>
  );
}
