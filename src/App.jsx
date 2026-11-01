import { useState } from "react";
import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Services from "./pages/Services";
import UrbanStudio from "./pages/UrbanStudio";
import LocationIntelligence from "./pages/LocationIntelligence";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";

import "./App.css";

export default function App() {
  const [page, setPage] = useState("home");

  function renderPage() {
    switch (page) {
      case "home":
        return <Home navigate={setPage} />;

      case "services":
        return <Services navigate={setPage} />;

      case "urban":
        return <UrbanStudio />;

      case "intelligence":
        return <LocationIntelligence />;

      case "contact":
        return <Contact />;

      case "admin":
        return <Admin />;

      default:
        return <Home navigate={setPage} />;
    }
  }

  return (
    <div className="traza-layout">
      <Navbar page={page} navigate={setPage} />

      <main className="traza-main">
        {renderPage()}
      </main>
    </div>
  );
}