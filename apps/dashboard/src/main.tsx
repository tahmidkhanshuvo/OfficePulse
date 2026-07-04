import React from "react";
import ReactDOM from "react-dom/client";
import { AdminLogin } from "./pages/AdminLogin";
import { Overview } from "./pages/Overview";
import { DeviceAnalytics } from "./pages/DeviceAnalytics";
import { Map } from "./pages/Map";
import { Logs } from "./pages/Logs";
import { Simulations } from "./pages/Simulations";
import { Settings } from "./pages/Settings";
import { Chatbot } from "./pages/Chatbot";
import { Support } from "./pages/Support";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Terms } from "./pages/Terms";
import { ContactSupport } from "./pages/ContactSupport";
import { deleteSession, getSession } from "./lib/api";
import { OfficeSnapshotProvider } from "./hooks/useOfficeSnapshot";

type Route =
  | "login"
  | "overview"
  | "map"
  | "analytics"
  | "simulations"
  | "logs"
  | "settings"
  | "support"
  | "privacy"
  | "terms"
  | "contact";

function hasRouteHash(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.replace(/^#\/?/, "").trim().length > 0;
}

function readRoute(): Route {
  if (typeof window === "undefined") return "login";
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "analytics") return "analytics";
  if (hash === "map") return "map";
  if (hash === "simulations") return "simulations";
  if (hash === "logs") return "logs";
  if (hash === "settings") return "settings";
  if (hash === "support") return "support";
  if (hash === "privacy") return "privacy";
  if (hash === "terms") return "terms";
  if (hash === "contact") return "contact";
  return hash === "overview" ? "overview" : "login";
}

function App() {
  const [route, setRoute] = React.useState<Route | "checking">(() => (hasRouteHash() ? readRoute() : "checking"));

  React.useEffect(() => {
    if (hasRouteHash()) return;
    let cancelled = false;
    getSession()
      .then((session) => {
        if (cancelled) return;
        window.location.replace(session.authenticated ? "#/overview" : "#/login");
      })
      .catch(() => {
        if (cancelled) return;
        window.location.replace("#/login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const exit = () => {
    deleteSession().finally(() => {
      window.location.hash = "#/login";
    });
  };

  if (route === "checking") {
    return (
      <div className="min-h-screen bg-bg-deep text-text-primary antialiased flex items-center justify-center">
        <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-4 font-label-caps text-label-caps uppercase text-text-secondary backdrop-blur-2xl">
          Opening OfficePulse
        </div>
      </div>
    );
  }

  if (route === "analytics") {
    return (
      <OfficeSnapshotProvider>
        <DeviceAnalytics onExit={exit} />
        <Chatbot />
      </OfficeSnapshotProvider>
    );
  }
  if (route === "map") {
    return (
      <OfficeSnapshotProvider>
        <Map onExit={exit} />
        <Chatbot />
      </OfficeSnapshotProvider>
    );
  }
  if (route === "logs") {
    return (
      <OfficeSnapshotProvider>
        <Logs onExit={exit} />
        <Chatbot />
      </OfficeSnapshotProvider>
    );
  }
  if (route === "simulations") {
    return (
      <OfficeSnapshotProvider>
        <Simulations onExit={exit} />
        <Chatbot />
      </OfficeSnapshotProvider>
    );
  }
  if (route === "settings") {
    return (
      <OfficeSnapshotProvider>
        <Settings onExit={exit} />
        <Chatbot />
      </OfficeSnapshotProvider>
    );
  }
  if (route === "overview") {
    return (
      <OfficeSnapshotProvider>
        <Overview onExit={exit} />
        <Chatbot />
      </OfficeSnapshotProvider>
    );
  }
  if (route === "support") {
    return <Support />;
  }
  if (route === "privacy") {
    return <PrivacyPolicy />;
  }
  if (route === "terms") {
    return <Terms />;
  }
  if (route === "contact") {
    return <ContactSupport />;
  }
  return <AdminLogin />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

