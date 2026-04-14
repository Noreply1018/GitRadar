import { NavLink as RouterNavLink } from "react-router";

export default function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <RouterNavLink
      to={to}
      end
      className={({ isActive }) =>
        `block px-4 py-2 rounded text-sm ${
          isActive
            ? "bg-blue-100 text-blue-700 font-medium"
            : "text-gray-600 hover:bg-gray-100"
        }`
      }
    >
      {children}
    </RouterNavLink>
  );
}
