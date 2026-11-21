import { useState } from "react";
import Navbar from "./components/Navbar";
import { AreaProvider } from "./state/AreaContext.jsx";
import { AuthProvider } from "./state/AuthContext";

import Home from "./pages/Home";
import Services from "./pages/Services";
import UrbanStudio from "./pages/UrbanStudio";
import LocationIntelligence from "./pages/LocationIntelligence";
import Walkability from "./pages/Walkability";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Account from "./pages/Account";

import "./App.css";

// El enlace de recuperación llega como ?reset=<token> desde el correo o desde
// el panel administrativo, sin necesidad de un enrutador.
const RESET_TOKEN = new URLSearchParams(window.location.search).get("reset") || "";

export default function App() {
  const [page, setPage] = useState(RESET_TOKEN ? "reset" : "home");
  const [studioHandoff, setStudioHandoff] = useState(null);

  function navigate(next, payload) {
    if (payload !== undefined) setStudioHandoff(payload);
    setPage(next);
  }

  function renderPage() {
    switch (page) {
      case "home":
        return <Home navigate={navigate} />;

      case "services":
        return <Services navigate={navigate} />;

      case "urban":
        return (
          <UrbanStudio
            handoff={studioHandoff}
            onHandoffConsumed={() => setStudioHandoff(null)}
          />
        );

      case "intelligence":
        return <LocationIntelligence />;

      case "walkability":
        return <Walkability />;

      case "contact":
        return <Contact />;

      case "admin":
        return <Admin />;

      case "login":
      case "register":
      case "forgot":
      case "reset":
        return (
          <Auth
            key={page}
            mode={page}
            navigate={navigate}
            resetToken={RESET_TOKEN}
          />
        );

      case "account":
        return <Account navigate={navigate} />;

      default:
        return <Home navigate={navigate} />;
    }
  }

  return (
    <AuthProvider>
      <AreaProvider>
        <div className="traza-layout">
          <a className="traza-skip-link" href="#main-content">Saltar al contenido</a>
          <Navbar page={page} navigate={navigate} />

          <main id="main-content" className="traza-main" tabIndex={-1}>
            {renderPage()}
          </main>
        </div>
      </AreaProvider>
    </AuthProvider>
  );
}
