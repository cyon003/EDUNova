import { useEffect, useRef, useState } from "react";
import { FaGlobe, FaSearch } from "react-icons/fa";
import "../styles/LanguagePreference.css";

const languages = [
  { code: "en", short: "EN", label: "English" },
  { code: "th", short: "TH", label: "Thai" },
  { code: "km", short: "KM", label: "Khmer" },
  { code: "zh", short: "ZH", label: "Chinese" },
];

function LanguagePreference() {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem("edunova-language") || "en");
  const [searchQuery, setSearchQuery] = useState("");
  const filteredLanguages = [...languages]
    .sort((first, second) => first.label.localeCompare(second.label))
    .filter((item) => `${item.label} ${item.short}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, []);

  const updateLanguage = (selectedLanguage) => {
    setLanguage(selectedLanguage);
    localStorage.setItem("edunova-language", selectedLanguage);
    setOpen(false);
  };

  return (
    <div className="language-preference" ref={containerRef}>
      <button type="button" className="language-trigger" onClick={() => setOpen((current) => !current)} aria-label="Choose website language" aria-expanded={open}>
        <FaGlobe />
      </button>
      {open && (
        <div className="language-menu" role="menu">
          <label className="language-search"><FaSearch /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find" aria-label="Find language" autoFocus /></label>
          {filteredLanguages.map((item) => (
            <button type="button" className={language === item.code ? "active" : undefined} onClick={() => updateLanguage(item.code)} role="menuitem" key={item.code}>{item.label} ({item.short})</button>
          ))}
          {!filteredLanguages.length && <span className="language-empty">No match</span>}
        </div>
      )}
    </div>
  );
}

export default LanguagePreference;
