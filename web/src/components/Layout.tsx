import { Outlet } from "react-router";
import NavLink from "./NavLink";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-lg font-bold mb-6 px-4">GitRadar</h1>
          <nav className="space-y-1">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/config">Config</NavLink>
            <NavLink to="/feedback">Feedback</NavLink>
            <NavLink to="/logs">Logs</NavLink>
          </nav>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 px-4 py-2 text-left"
        >
          退出登录
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
