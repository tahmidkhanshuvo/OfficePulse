import React from "react";
import ReactDOM from "react-dom/client";
import { AdminLogin } from "./pages/AdminLogin";
import { Overview } from "./pages/Overview";
import { DeviceAnalytics } from "./pages/DeviceAnalytics";
import { Map } from "./pages/Map";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";
import { Chatbot } from "./pages/Chatbot";
import { Support } from "./pages/Support";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Terms } from "./pages/Terms";
import { ContactSupport } from "./pages/ContactSupport";
import { deleteSession } from "./lib/api";

type Route =
  | "login"
  | "overview"
  | "map"
  | "analytics"
  | "logs"
  | "settings"
  | "support"
  | "privacy"
  | "terms"
  | "contact";

function readRoute(): Route {
  if (typeof window === "undefined") return "login";
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "analytics") return "analytics";
  if (hash === "map") return "map";
  if (hash === "logs") return "logs";
  if (hash === "settings") return "settings";
  if (hash === "support") return "support";
  if (hash === "privacy") return "privacy";
  if (hash === "terms") return "terms";
  if (hash === "contact") return "contact";
  return hash === "overview" ? "overview" : "login";
}

function App() {
  const [route, setRoute] = React.useState<Route>(readRoute);

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

  if (route === "analytics") {
    return (
      <>
        <DeviceAnalytics onExit={exit} />
        <Chatbot />
      </>
    );
  }
  if (route === "map") {
    return (
      <>
        <Map onExit={exit} />
        <Chatbot />
      </>
    );
  }
  if (route === "logs") {
    return (
      <>
        <Logs onExit={exit} />
        <Chatbot />
      </>
    );
  }
  if (route === "settings") {
    return (
      <>
        <Settings onExit={exit} />
        <Chatbot />
      </>
    );
  }
  if (route === "overview") {
    return (
      <>
        <Overview onExit={exit} />
        <Chatbot />
      </>
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

