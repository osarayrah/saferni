import React, { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Home,
  MapPin,
  MessageCircle,
  Package,
  Plane,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

type Mode = "flights" | "hotels" | "packages" | "general";

type Destination = {
  city: string;
  country: string;
  vibe: string;
  budget: string;
  image: string;
  months: string;
};

const destinations: Destination[] = [
  {
    city: "Lisbon",
    country: "Portugal",
    vibe: "Sun-washed streets",
    budget: "$1,240",
    image: "linear-gradient(145deg, #bd765b 0%, #e5b079 46%, #50717b 47%, #193b49 100%)",
    months: "Apr – Oct",
  },
  {
    city: "Kyoto",
    country: "Japan",
    vibe: "Quiet, considered",
    budget: "$1,860",
    image: "linear-gradient(140deg, #d07b6d 0%, #e6b88c 38%, #7b927f 39%, #304e4d 100%)",
    months: "Mar – May",
  },
  {
    city: "Marrakech",
    country: "Morocco",
    vibe: "Colour after dark",
    budget: "$980",
    image: "linear-gradient(140deg, #bc654e 0%, #e3a36b 44%, #77805b 45%, #28383a 100%)",
    months: "Oct – Apr",
  },
  {
    city: "Reykjavík",
    country: "Iceland",
    vibe: "Wild at the edges",
    budget: "$1,670",
    image: "linear-gradient(135deg, #8b9b99 0%, #d7d8c5 43%, #638078 44%, #2f4950 100%)",
    months: "Jun – Sep",
  },
];

const modes: { key: Mode; label: string; icon: React.ElementType }[] = [
  { key: "flights", label: "Flights", icon: Send },
  { key: "hotels", label: "Hotels", icon: Home },
  { key: "packages", label: "Packages", icon: Package },
  { key: "general", label: "Ask Safferni", icon: MessageCircle },
];

export function SafferniStackedHomeVariant() {
  const [mode, setMode] = useState<Mode>("packages");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>(["Kyoto"]);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState("Home");

  const filteredDestinations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((destination) =>
      `${destination.city} ${destination.country} ${destination.vibe}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const startPlanning = (destination?: string) => {
    announce(destination ? `Building a ${destination} plan` : "Opening your trip brief");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) {
      announce(`Searching for ${query.trim()}`);
    }
  };

  const toggleSaved = (city: string) => {
    setSaved((current) => (current.includes(city) ? current.filter((item) => item !== city) : [...current, city]));
  };

  return (
    <main className="safferni-variant" style={{ "--ink": "#2c3029", "--paper": "#f4f0e7", "--line": "#d9d3c5" } as React.CSSProperties}>
      <style>{`
        .safferni-variant, .safferni-variant * { box-sizing: border-box; }
        .safferni-variant { min-height: 100%; width: 100%; overflow-y: auto; background: var(--paper); color: var(--ink); font-family: "DM Sans", "Trebuchet MS", sans-serif; }
        .safferni-variant button, .safferni-variant input { font: inherit; }
        .safferni-variant button { cursor: pointer; }
        .safferni-variant::-webkit-scrollbar { width: 5px; }
        .safferni-variant::-webkit-scrollbar-thumb { background: #c7bca9; border-radius: 99px; }
        .sv-shell { max-width: 560px; margin: 0 auto; padding: 22px 18px 26px; }
        .sv-appear { animation: sv-rise .55s cubic-bezier(.2,.75,.25,1) both; }
        .sv-delay-1 { animation-delay: .06s; }
        .sv-delay-2 { animation-delay: .13s; }
        .sv-delay-3 { animation-delay: .2s; }
        .sv-delay-4 { animation-delay: .27s; }
        @keyframes sv-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .sv-display { font-family: Georgia, "Times New Roman", serif; letter-spacing: -.045em; }
        .sv-eyebrow { color: #7a8069; font-size: 10px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
        .sv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
        .sv-brand { display: flex; align-items: center; gap: 9px; }
        .sv-brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 12px; background: #d1b16d; color: #2c3029; }
        .sv-brand-name { font-family: Georgia, "Times New Roman", serif; font-size: 20px; letter-spacing: -.035em; }
        .sv-header-actions { display: flex; gap: 8px; }
        .sv-icon-btn { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.24); color: #62685d; transition: transform .18s ease, background-color .18s ease; }
        .sv-icon-btn:hover { transform: translateY(-1px); background: #ebe5d8; }
        .sv-intro { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: end; margin-bottom: 18px; }
        .sv-intro h1 { margin: 5px 0 0; font-size: clamp(31px, 8vw, 42px); line-height: .98; font-weight: 400; }
        .sv-intro-copy { margin: 7px 0 0; max-width: 290px; color: #777a70; font-size: 12px; line-height: 1.45; }
        .sv-date-stamp { border-left: 1px solid #c9c1b2; padding-left: 12px; color: #7c816f; font-size: 10px; line-height: 1.35; letter-spacing: .08em; text-transform: uppercase; }
        .sv-date-stamp strong { display: block; margin-top: 2px; color: var(--ink); font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 400; letter-spacing: -.04em; text-transform: none; }
        .sv-command { display: grid; grid-template-columns: 1fr 1.04fr; gap: 0; min-height: 234px; overflow: hidden; border-radius: 22px; background: #263b3b; box-shadow: 0 16px 35px rgba(43, 52, 42, .13); }
        .sv-command-copy { display: flex; flex-direction: column; justify-content: space-between; padding: 18px 14px 16px; }
        .sv-command-image { position: relative; min-height: 234px; background-image: url("/__mockup/images/safferni-stacked-home-hero.jpg"); background-position: 58% center; background-size: cover; }
        .sv-command-image:after { position: absolute; inset: 0; content: ""; background: linear-gradient(90deg, rgba(38,59,59,.18), transparent 55%); }
        .sv-command-kicker { color: #d1b16d; font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .sv-command h2 { max-width: 170px; margin: 11px 0 0; color: #f3eee3; font-family: Georgia, "Times New Roman", serif; font-size: 28px; line-height: .98; font-weight: 400; letter-spacing: -.045em; }
        .sv-command p { max-width: 148px; margin: 9px 0 0; color: #bdc5b7; font-size: 11px; line-height: 1.45; }
        .sv-plan-button { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border: 0; border-radius: 11px; padding: 11px 12px; background: #d1b16d; color: #29322e; font-size: 11px; font-weight: 800; transition: transform .18s ease, background-color .18s ease; }
        .sv-plan-button:hover { transform: translateY(-1px); background: #e0c485; }
        .sv-plan-button svg { width: 15px; height: 15px; }
        .sv-mode-bar { display: flex; gap: 7px; overflow-x: auto; padding: 15px 0 2px; scrollbar-width: none; }
        .sv-mode-bar::-webkit-scrollbar { display: none; }
        .sv-mode { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--line); border-radius: 999px; padding: 9px 11px; background: transparent; color: #6d7168; font-size: 11px; font-weight: 700; transition: background-color .18s ease, color .18s ease, border-color .18s ease; }
        .sv-mode svg { width: 14px; height: 14px; }
        .sv-mode[data-active="true"] { border-color: #caa65c; background: #d1b16d; color: #29322e; }
        .sv-section-head { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin: 25px 0 11px; }
        .sv-section-head h3 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 400; letter-spacing: -.04em; }
        .sv-section-link { display: inline-flex; align-items: center; gap: 3px; border: 0; padding: 0; background: transparent; color: #7e856d; font-size: 11px; font-weight: 800; }
        .sv-section-link svg { width: 13px; height: 13px; }
        .sv-trip-card { position: relative; overflow: hidden; border: 1px solid #d3cdc0; border-radius: 17px; background: #ebe5d9; }
        .sv-trip-top { display: flex; align-items: start; justify-content: space-between; padding: 14px 14px 11px; }
        .sv-trip-label { color: #7e856d; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .sv-trip-title { margin: 4px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: 22px; font-weight: 400; letter-spacing: -.04em; }
        .sv-status { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 7px; background: #d5ddcb; color: #5a715a; font-size: 9px; font-weight: 800; }
        .sv-status-dot { width: 5px; height: 5px; border-radius: 50%; background: #6a8968; }
        .sv-trip-rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid #d3cdc0; border-bottom: 1px solid #d3cdc0; background: rgba(255,255,255,.24); }
        .sv-trip-stat { padding: 10px 7px; border-right: 1px solid #d3cdc0; }
        .sv-trip-stat:last-child { border-right: 0; }
        .sv-trip-stat span { display: block; color: #83867a; font-size: 9px; }
        .sv-trip-stat strong { display: block; margin-top: 3px; color: #394239; font-size: 11px; font-weight: 800; }
        .sv-trip-footer { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; }
        .sv-trip-footer span { display: inline-flex; align-items: center; gap: 5px; color: #777b70; font-size: 10px; }
        .sv-trip-footer svg { width: 13px; height: 13px; color: #a4864e; }
        .sv-open-trip { display: inline-flex; align-items: center; gap: 4px; border: 0; padding: 0; background: transparent; color: #8a7042; font-size: 11px; font-weight: 800; }
        .sv-open-trip svg { width: 14px; height: 14px; }
        .sv-search { display: flex; align-items: center; gap: 9px; margin-top: 23px; border: 1px solid var(--line); border-radius: 13px; padding: 10px 12px; background: rgba(255,255,255,.3); }
        .sv-search:focus-within { border-color: #b8a16d; background: #f8f5ee; }
        .sv-search svg { width: 16px; height: 16px; color: #888a7d; }
        .sv-search input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 12px; }
        .sv-search input::placeholder { color: #9a9a8f; }
        .sv-destination-list { display: grid; grid-template-columns: 1.12fr .88fr; gap: 9px; }
        .sv-destination { position: relative; min-height: 151px; overflow: hidden; border: 0; border-radius: 16px; padding: 0; text-align: left; background: #9a775e; color: #fff; }
        .sv-destination:nth-child(3n) { min-height: 115px; }
        .sv-destination-visual { position: absolute; inset: 0; opacity: .88; transition: transform .45s ease; }
        .sv-destination:hover .sv-destination-visual { transform: scale(1.05); }
        .sv-destination:after { position: absolute; inset: 0; content: ""; background: linear-gradient(180deg, rgba(19,30,29,.02) 15%, rgba(19,30,29,.72) 100%); }
        .sv-destination-copy { position: absolute; inset: auto 11px 11px; z-index: 1; }
        .sv-destination-copy small { display: block; color: #e8ce96; font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        .sv-destination-copy strong { display: block; margin-top: 3px; font-family: Georgia, "Times New Roman", serif; font-size: 18px; font-weight: 400; letter-spacing: -.04em; }
        .sv-destination-copy span { display: block; margin-top: 2px; color: rgba(255,255,255,.7); font-size: 10px; }
        .sv-save { position: absolute; z-index: 2; top: 9px; right: 9px; display: grid; place-items: center; width: 27px; height: 27px; border: 1px solid rgba(255,255,255,.36); border-radius: 50%; background: rgba(30,42,37,.22); color: #fff; }
        .sv-save[data-saved="true"] { border-color: #e8ce96; background: #e8ce96; color: #384237; }
        .sv-save svg { width: 13px; height: 13px; }
        .sv-no-results { grid-column: 1 / -1; border: 1px dashed #c9c1b2; border-radius: 14px; padding: 22px; color: #777a70; text-align: center; font-size: 12px; }
        .sv-bottom-nav { position: sticky; bottom: 0; z-index: 5; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 24px -18px -26px; border-top: 1px solid #ded8cc; padding: 10px 18px 12px; background: rgba(244,240,231,.92); backdrop-filter: blur(12px); }
        .sv-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: transparent; color: #97988e; font-size: 9px; font-weight: 700; }
        .sv-nav-item[data-active="true"] { color: #827044; }
        .sv-nav-item svg { width: 17px; height: 17px; }
        .sv-toast { position: fixed; z-index: 10; left: 50%; bottom: 23px; transform: translateX(-50%); border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 10px 14px; background: #293a36; color: #f4f0e7; box-shadow: 0 10px 25px rgba(35,43,35,.2); font-size: 11px; font-weight: 700; animation: sv-rise .2s ease both; }
        @media (min-width: 640px) { .sv-shell { padding: 30px 24px 34px; } .sv-bottom-nav { margin-left: -24px; margin-right: -24px; padding-left: 24px; padding-right: 24px; } }
      `}</style>

      <div className="sv-shell">
        <header className="sv-header sv-appear">
          <div className="sv-brand">
            <div className="sv-brand-mark" aria-hidden="true"><Compass size={18} /></div>
            <span className="sv-brand-name">safferni</span>
          </div>
          <div className="sv-header-actions">
            <button className="sv-icon-btn" type="button" onClick={() => setShowSearch((current) => !current)} aria-label="Search destinations">
              <Search size={17} />
            </button>
            <button className="sv-icon-btn" type="button" onClick={() => announce("Profile is ready to personalise")} aria-label="Open profile">
              <UserRound size={17} />
            </button>
          </div>
        </header>

        <section className="sv-intro sv-appear sv-delay-1">
          <div>
            <div className="sv-eyebrow">Your travel companion</div>
            <h1 className="sv-display">Where next<br />feels right?</h1>
            <p className="sv-intro-copy">A quieter way to plan the places you have been thinking about.</p>
          </div>
          <div className="sv-date-stamp">Local time<strong>09:42</strong>Tuesday, 21 May</div>
        </section>

        <section className="sv-command sv-appear sv-delay-2" aria-label="Start planning">
          <div className="sv-command-copy">
            <div>
              <div className="sv-command-kicker">Curated for the curious</div>
              <h2>A good trip starts with a feeling.</h2>
              <p>Tell Safferni what you want to remember. We will handle the rest.</p>
            </div>
            <button className="sv-plan-button" type="button" onClick={() => startPlanning()}>
              Start a new plan <ArrowUpRight />
            </button>
          </div>
          <div className="sv-command-image" role="img" aria-label="Coastal destination with warm evening light" />
        </section>

        <div className="sv-mode-bar sv-appear sv-delay-3" aria-label="Planning modes">
          {modes.map(({ key, label, icon: Icon }) => (
            <button key={key} className="sv-mode" type="button" data-active={mode === key} onClick={() => { setMode(key); announce(`${label} mode selected`); }}>
              <Icon /> {label}
            </button>
          ))}
        </div>

        <section className="sv-appear sv-delay-3">
          <div className="sv-section-head">
            <div>
              <div className="sv-eyebrow">Your next chapter</div>
              <h3>Upcoming trip</h3>
            </div>
            <button className="sv-section-link" type="button" onClick={() => { setActiveTab("Trips"); announce("Opening all trips"); }}>
              All trips <ChevronRight />
            </button>
          </div>

          <article className="sv-trip-card">
            <div className="sv-trip-top">
              <div>
                <div className="sv-trip-label">Draft itinerary · 7 nights</div>
                <div className="sv-trip-title">Lisbon, Portugal</div>
              </div>
              <span className="sv-status"><span className="sv-status-dot" /> In progress</span>
            </div>
            <div className="sv-trip-rail">
              <div className="sv-trip-stat"><span>Depart</span><strong>14 Jun</strong></div>
              <div className="sv-trip-stat"><span>Travellers</span><strong>2 adults</strong></div>
              <div className="sv-trip-stat"><span>Budget</span><strong>$1,240</strong></div>
              <div className="sv-trip-stat"><span>Saved</span><strong><Check size={11} style={{ verticalAlign: "-2px" }} /> 3</strong></div>
            </div>
            <div className="sv-trip-footer">
              <span><WalletCards /> Package estimate · flexible</span>
              <button className="sv-open-trip" type="button" onClick={() => announce("Opening Lisbon itinerary")}>Open trip <ArrowUpRight /></button>
            </div>
          </article>
        </section>

        {showSearch && (
          <form className="sv-search sv-appear" onSubmit={submitSearch}>
            <Search />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations or vibes…" aria-label="Search destinations" />
            {query && <button className="sv-icon-btn" type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ width: 24, height: 24, border: 0 }}><X size={14} /></button>}
          </form>
        )}

        <section className="sv-appear sv-delay-4">
          <div className="sv-section-head">
            <div>
              <div className="sv-eyebrow">Small ideas, big horizons</div>
              <h3>Find your next feeling</h3>
            </div>
            <button className="sv-section-link" type="button" onClick={() => { setShowSearch(true); announce("Search is ready"); }}>
              Explore <ChevronRight />
            </button>
          </div>

          <div className="sv-destination-list">
            {filteredDestinations.length ? filteredDestinations.map((destination) => (
              <button className="sv-destination" type="button" key={destination.city} onClick={() => startPlanning(destination.city)}>
                <span className="sv-destination-visual" style={{ background: destination.image }} />
                <span className="sv-save" data-saved={saved.includes(destination.city)} role="button" aria-label={`${saved.includes(destination.city) ? "Remove" : "Save"} ${destination.city}`} onClick={(event) => { event.stopPropagation(); toggleSaved(destination.city); announce(saved.includes(destination.city) ? `${destination.city} removed from saved` : `${destination.city} saved`); }}>
                  <Bookmark size={13} fill={saved.includes(destination.city) ? "currentColor" : "none"} />
                </span>
                <span className="sv-destination-copy">
                  <small>{destination.country} · {destination.months}</small>
                  <strong>{destination.city}</strong>
                  <span>{destination.vibe} · est. {destination.budget}</span>
                </span>
              </button>
            )) : (
              <div className="sv-no-results">No destinations match that feeling. Try “coast”, “quiet”, or a city.</div>
            )}
          </div>
        </section>

        <nav className="sv-bottom-nav" aria-label="Main navigation">
          {[
            { label: "Home", icon: Compass },
            { label: "Trips", icon: CalendarDays },
            { label: "Saved", icon: Bookmark },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className="sv-nav-item" data-active={activeTab === label} type="button" onClick={() => { setActiveTab(label); announce(label === "Home" ? "You are home" : `${label} view selected`); }}>
              <Icon fill={activeTab === label && label === "Saved" ? "currentColor" : "none"} />{label}
            </button>
          ))}
        </nav>
      </div>
      {toast && <div className="sv-toast" role="status">{toast}</div>}
    </main>
  );
}

export default SafferniStackedHomeVariant;