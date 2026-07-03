import React from "react";
import ReactDOM from "react-dom/client";
import { AdminLogin } from "./pages/AdminLogin";
import { Overview } from "./pages/Overview";
import { DeviceAnalytics } from "./pages/DeviceAnalytics";
import { Map } from "./pages/Map";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";

type Route = "login" | "overview" | "map" | "analytics" | "logs" | "settings";

function readRoute(): Route {
  if (typeof window === "undefined") return "login";
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "analytics") return "analytics";
  if (hash === "map") return "map";
  if (hash === "logs") return "logs";
  if (hash === "settings") return "settings";
  return hash === "overview" ? "overview" : "login";
}

function App() {
  const [route, setRoute] = React.useState<Route>(readRoute);

  React.useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const exit = () => (window.location.hash = "#/login");

  if (route === "analytics") {
    return <DeviceAnalytics onExit={exit} />;
  }
  if (route === "map") {
    return <Map onExit={exit} />;
  }
  if (route === "logs") {
    return <Logs onExit={exit} />;
  }
  if (route === "settings") {
    return <Settings onExit={exit} />;
  }
  if (route === "overview") {
    return <Overview onExit={exit} />;
  }
  return <AdminLogin />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

