import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import SetupPage from "./pages/SetupPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();

  if (!auth) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return <div className="p-8 text-lg">{title}</div>;
}

export default function App() {
  return (
    <BrowserRouter basename="/GitRadar">
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Routes>
                <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
                <Route path="/history" element={<PlaceholderPage title="History" />} />
                <Route path="/config" element={<PlaceholderPage title="Config" />} />
                <Route path="/feedback" element={<PlaceholderPage title="Feedback" />} />
                <Route path="/logs" element={<PlaceholderPage title="Logs" />} />
              </Routes>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
