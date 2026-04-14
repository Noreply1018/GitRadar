import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import SetupPage from "./pages/SetupPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();

  if (!auth) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return <h2 className="text-xl font-semibold">{title}</h2>;
}

export default function App() {
  return (
    <BrowserRouter basename="/GitRadar">
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
          <Route path="/history" element={<PlaceholderPage title="History" />} />
          <Route path="/config" element={<PlaceholderPage title="Config" />} />
          <Route path="/feedback" element={<PlaceholderPage title="Feedback" />} />
          <Route path="/logs" element={<PlaceholderPage title="Logs" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
