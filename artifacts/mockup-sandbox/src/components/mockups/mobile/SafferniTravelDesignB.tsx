import React, { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Compass,
  Home,
  MessageCircle,
  Package,
  Search,
  Send,
  Sparkles,
  UserRound,
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
  code: string;
  tint: string;
};

type Trip = {
  city: string;
  country: string;
  dates: string;
  state: string;
  progress: number;
  accent: string;
  note: string;
};

const destinations: Destination[] = [
  {
    city: "Lisbon",
    country: "Portugal",
    vibe: "Sun-washed streets",
    budget: "$1,240",
    image: "url('/__mockup/images/safferni-stacked-home-hero.jpg')",
    months: "Apr – Oct",
    code: "LIS",
    tint: "#c68063",
  },
  {
    city: "Kyoto",
    country: "Japan",
    vibe: "Quiet, considered",
    budget: "$1,860",
    image: "linear-gradient(145deg, #b94f49 0%, #d99e73 39%, #879980 40%, #293e42 100%)",
    months: "Mar – May",
    code: "KIX",
    tint: "#b9a76d",
  },
  {
    city: "Marrakech",
    country: "Morocco",
    vibe: "Colour after dark",
    budget: "$980",
    image: "linear-gradient(145deg, #a94d3f 0%, #db9666 46%, #6d7958 47%, #243a3e 100%)",
    months: "Oct – Apr",
    code: "RAK",
    tint: "#ce8667",
  },
  {
    city: "Reykjavík",
    country: "Iceland",
    vibe: "Wild at the edges",
    budget: "$1,670",
    image: "linear-gradient(145deg, #a6b1a4 0%, #d9d8bf 44%, #66867b 45%, #28434a 100%)",
    months: "Jun – Sep",
    code: "KEF",
    tint: "#93a58a",
  },
];

const trips: Trip[] = [
  {
    city: "Lisbon",
    country: "Portugal",
    dates: "14 – 21 Jun",
    state: "In progress",
    progress: 68,
    accent: "#d3b56e",
    note: "7 nights · 2 travellers",
  },
  {
    city: "Kyoto",
    country: "Japan",
    dates: "03 – 10 Oct",
    state: "Saved for later",
    progress: 24,
    accent: "#94a387",
    note: "7 nights · slow itinerary",
  },
];

const modes: { key: Mode; label: string; helper: string; icon: React.ElementType }[] = [
  { key: "flights", label: "Flights", helper: "Find a route", icon: Send },
  { key: "hotels", label: "Hotels", helper: "Choose a stay", icon: Home },
  { key: "packages", label: "Packages", helper: "Build the whole trip", icon: Package },
  { key: "general", label: "Ask Safferni", helper: "Start with a feeling", icon: MessageCircle },
];

const navItems = [
  { label: "Command", icon: Compass },
  { label: "Trips", icon: CalendarDays },
  { label: "Saved", icon: Bookmark },
];

export function SafferniTravelDesignB() {
  const [mode, setMode] = useState<Mode>("packages");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>(["Kyoto"]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTrip, setActiveTrip] = useState("Lisbon");
  const [activeTab, setActiveTab] = useState("Command");
  const [toast, setToast] = useState("");

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

  const chooseMode = (nextMode: Mode) => {
    setMode(nextMode);
    const nextLabel = modes.find((item) => item.key === nextMode)?.label;
    announce(`${nextLabel} mode selected`);
  };

  const startPlanning = (destination?: string) => {
    announce(destination ? `Building a ${destination} plan` : `Opening ${modes.find((item) => item.key === mode)?.label.toLowerCase()} brief`);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) announce(`Searching for ${query.trim()}`);
  };

  const toggleSaved = (city: string) => {
    const wasSaved = saved.includes(city);
    setSaved((current) => (wasSaved ? current.filter((item) => item !== city) : [...current, city]));
    announce(wasSaved ? `${city} removed from saved` : `${city} saved for later`);
  };

  const openTrip = (city: string) => {
    setActiveTrip(city);
    announce(`Opening ${city} itinerary`);
  };

  return (
    <main
      className="safferni-command"
      style={
        {
          "--navy": "#0c1d3a",
          "--navy-soft": "#152b4d",
          "--gold": "#d3b56e",
          "--gold-pale": "#ebdbab",
          "--sage": "#a9b29a",
          "--olive": "#68765d",
          "--canvas": "#f1eee6",
          "--ink": "#162237",
          "--line": "#d8d4c8",
        } as CSSProperties
      }
    >
      <style>{`
        .safferni-command, .safferni-command * { box-sizing: border-box; }
        .safferni-command {
          min-height: 100%;
          width: 100%;
          overflow-y: auto;
          background:
            radial-gradient(circle at 8% 12%, rgba(211,181,110,.13), transparent 26%),
            var(--canvas);
          color: var(--ink);
          font-family: "DM Sans", "Trebuchet MS", sans-serif;
        }
        .safferni-command button, .safferni-command input { font: inherit; }
        .safferni-command button { cursor: pointer; }
        .safferni-command::-webkit-scrollbar { width: 5px; }
        .safferni-command::-webkit-scrollbar-thumb { background: #b9b49f; border-radius: 99px; }
        .sc-shell { max-width: 600px; margin: 0 auto; padding: 18px 17px 27px; }
        .sc-display { font-family: Georgia, "Times New Roman", serif; letter-spacing: -.052em; }
        .sc-appear { animation: sc-rise .52s cubic-bezier(.2,.75,.25,1) both; }
        .sc-delay-1 { animation-delay: .06s; }
        .sc-delay-2 { animation-delay: .12s; }
        .sc-delay-3 { animation-delay: .18s; }
        .sc-delay-4 { animation-delay: .24s; }
        @keyframes sc-rise { from { opacity: 0; transform: translateY(11px); } to { opacity: 1; transform: translateY(0); } }
        .sc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
        .sc-brand { display: flex; align-items: center; gap: 9px; }
        .sc-brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--gold); color: var(--navy); }
        .sc-brand-mark svg { width: 18px; height: 18px; }
        .sc-brand-name { color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 21px; letter-spacing: -.045em; }
        .sc-brand-label { margin-left: 1px; color: var(--olive); font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .sc-header-actions { display: flex; gap: 8px; }
        .sc-icon-btn { display: grid; place-items: center; width: 35px; height: 35px; border: 1px solid var(--line); border-radius: 11px; background: rgba(255,255,255,.28); color: #64705f; transition: transform .18s ease, background-color .18s ease; }
        .sc-icon-btn:hover { transform: translateY(-1px); background: #e8e4d9; }
        .sc-icon-btn svg { width: 16px; height: 16px; }
        .sc-welcome { display: flex; align-items: end; justify-content: space-between; gap: 13px; margin-bottom: 19px; }
        .sc-kicker { color: var(--olive); font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .sc-welcome h1 { max-width: 315px; margin: 7px 0 0; color: var(--navy); font-size: clamp(32px, 8.8vw, 46px); line-height: .94; font-weight: 400; }
        .sc-welcome-copy { max-width: 280px; margin: 9px 0 0; color: #6f776e; font-size: 11px; line-height: 1.5; }
        .sc-stamp { flex: 0 0 auto; border-left: 1px solid #c8c7bc; padding-left: 11px; color: #7e8778; font-size: 9px; line-height: 1.35; letter-spacing: .11em; text-transform: uppercase; }
        .sc-stamp strong { display: block; margin-top: 4px; color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 400; letter-spacing: -.04em; text-transform: none; }
        .sc-command {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          padding: 17px;
          background: var(--navy);
          color: #f5f0e6;
          box-shadow: 0 18px 32px rgba(12,29,58,.15);
        }
        .sc-command:after { position: absolute; right: -46px; bottom: -73px; width: 194px; height: 194px; border: 1px solid rgba(211,181,110,.2); border-radius: 50%; content: ""; }
        .sc-command-top { position: relative; z-index: 1; display: flex; align-items: start; justify-content: space-between; gap: 14px; }
        .sc-command-kicker { color: var(--gold); font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .sc-command h2 { max-width: 255px; margin: 10px 0 0; font-size: clamp(25px, 6.6vw, 34px); line-height: .99; font-weight: 400; }
        .sc-command-copy { max-width: 262px; margin: 9px 0 0; color: #b6c0c2; font-size: 11px; line-height: 1.45; }
        .sc-command-badge { display: inline-flex; align-items: center; gap: 5px; border: 1px solid rgba(211,181,110,.38); border-radius: 999px; padding: 6px 8px; color: var(--gold-pale); font-size: 9px; font-weight: 800; white-space: nowrap; }
        .sc-command-badge svg { width: 11px; height: 11px; }
        .sc-plan-row { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; margin-top: 21px; }
        .sc-primary { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; border: 0; border-radius: 10px; padding: 11px 12px; background: var(--gold); color: var(--navy); font-size: 11px; font-weight: 800; transition: transform .18s ease, background-color .18s ease; }
        .sc-primary:hover { transform: translateY(-1px); background: #e1c884; }
        .sc-primary svg { width: 15px; height: 15px; }
        .sc-secondary { display: inline-flex; align-items: center; gap: 5px; border: 0; padding: 5px 0; background: transparent; color: #c1c8bd; font-size: 10px; font-weight: 700; }
        .sc-secondary svg { width: 13px; height: 13px; }
        .sc-mode-shell { margin-top: 17px; }
        .sc-section-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; color: #79816f; font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .sc-mode-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .sc-mode { position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; min-height: 54px; border: 1px solid var(--line); border-radius: 13px; padding: 9px 10px; background: rgba(255,255,255,.23); color: #70796d; text-align: left; transition: transform .18s ease, border-color .18s ease, background-color .18s ease; }
        .sc-mode:hover { transform: translateY(-1px); border-color: #b5ab8d; }
        .sc-mode[data-active="true"] { border-color: var(--gold); background: #e8dfc8; color: var(--navy); }
        .sc-mode-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: #e5e3d8; color: var(--olive); }
        .sc-mode[data-active="true"] .sc-mode-icon { background: var(--gold); color: var(--navy); }
        .sc-mode-icon svg { width: 14px; height: 14px; }
        .sc-mode-name { display: block; font-size: 11px; font-weight: 800; }
        .sc-mode-helper { display: block; margin-top: 2px; color: #92998d; font-size: 9px; }
        .sc-mode[data-active="true"] .sc-mode-helper { color: #68735d; }
        .sc-mode-check { width: 13px; height: 13px; color: var(--olive); opacity: 0; }
        .sc-mode[data-active="true"] .sc-mode-check { opacity: 1; }
        .sc-section-head { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin: 27px 0 10px; }
        .sc-section-head h3 { margin: 4px 0 0; color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 23px; font-weight: 400; letter-spacing: -.045em; }
        .sc-link { display: inline-flex; align-items: center; gap: 3px; border: 0; padding: 0; background: transparent; color: #7b866d; font-size: 10px; font-weight: 800; }
        .sc-link svg { width: 13px; height: 13px; }
        .sc-trip-list { display: grid; gap: 8px; }
        .sc-trip-card { display: grid; grid-template-columns: 5px 1fr auto; gap: 11px; align-items: stretch; border: 1px solid #d7d3c7; border-radius: 15px; padding: 11px 11px 11px 9px; background: rgba(255,255,255,.35); text-align: left; transition: transform .18s ease, border-color .18s ease, background-color .18s ease; }
        .sc-trip-card:hover, .sc-trip-card[data-active="true"] { transform: translateY(-1px); border-color: #bfc0af; background: #f7f3e9; }
        .sc-trip-rail { width: 5px; border-radius: 99px; background: var(--trip-accent); }
        .sc-trip-meta { min-width: 0; }
        .sc-trip-state { display: inline-flex; align-items: center; gap: 5px; color: #718068; font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .sc-trip-state svg { width: 11px; height: 11px; }
        .sc-trip-title { margin: 5px 0 2px; color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 20px; font-weight: 400; letter-spacing: -.04em; }
        .sc-trip-note { color: #858b80; font-size: 10px; }
        .sc-trip-date { display: flex; align-items: center; gap: 5px; color: #566653; font-size: 10px; font-weight: 800; white-space: nowrap; }
        .sc-trip-date svg { width: 13px; height: 13px; color: #a18b54; }
        .sc-trip-progress { grid-column: 2 / -1; display: flex; align-items: center; gap: 8px; padding-top: 3px; }
        .sc-progress-track { height: 4px; flex: 1; overflow: hidden; border-radius: 99px; background: #deddd2; }
        .sc-progress-fill { height: 100%; border-radius: inherit; background: var(--trip-accent); }
        .sc-progress-label { color: #879080; font-size: 9px; font-weight: 800; }
        .sc-search { display: flex; align-items: center; gap: 8px; margin-top: 25px; border: 1px solid var(--line); border-radius: 12px; padding: 10px 11px; background: rgba(255,255,255,.36); }
        .sc-search:focus-within { border-color: #b9a56f; background: #faf8f1; }
        .sc-search > svg { width: 15px; height: 15px; color: #7e8976; }
        .sc-search input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--navy); font-size: 11px; }
        .sc-search input::placeholder { color: #9a9e92; }
        .sc-search-clear { display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 50%; background: #e3e1d7; color: #687362; }
        .sc-search-clear svg { width: 12px; height: 12px; }
        .sc-destination-list { display: grid; grid-template-columns: 1.15fr .85fr; gap: 8px; }
        .sc-destination { position: relative; min-height: 143px; overflow: hidden; border-radius: 15px; background: #607064; color: #fff; }
        .sc-destination:nth-child(3n) { min-height: 116px; }
        .sc-destination:nth-child(4n) { min-height: 129px; }
        .sc-destination-visual { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; padding: 0; background-color: transparent; background-position: center; background-size: cover; opacity: .92; transition: transform .45s ease; }
        .sc-destination:hover .sc-destination-visual { transform: scale(1.05); }
        .sc-destination:after { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,29,58,.02) 22%, rgba(12,29,58,.78) 100%); content: ""; }
        .sc-destination-copy { position: absolute; right: 10px; bottom: 10px; left: 10px; z-index: 1; border: 0; padding: 0; background: transparent; color: inherit; text-align: left; }
        .sc-destination-copy small { display: block; color: var(--gold-pale); font-size: 8px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .sc-destination-copy strong { display: block; margin-top: 3px; font-family: Georgia, "Times New Roman", serif; font-size: 19px; font-weight: 400; letter-spacing: -.045em; }
        .sc-destination-copy span { display: block; margin-top: 2px; color: rgba(255,255,255,.72); font-size: 9px; }
        .sc-save { position: absolute; z-index: 2; top: 8px; right: 8px; display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid rgba(255,255,255,.4); border-radius: 50%; background: rgba(12,29,58,.25); color: #fff; transition: transform .18s ease, background-color .18s ease; }
        .sc-save:hover { transform: scale(1.05); }
        .sc-save[data-saved="true"] { border-color: var(--gold-pale); background: var(--gold-pale); color: var(--navy); }
        .sc-save svg { width: 13px; height: 13px; }
        .sc-empty { grid-column: 1 / -1; border: 1px dashed #c9c4b7; border-radius: 14px; padding: 24px 14px; color: #777f72; text-align: center; font-size: 11px; }
        .sc-bottom-nav { position: sticky; bottom: 0; z-index: 5; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 26px -17px -27px; border-top: 1px solid #dbd8cd; padding: 9px 17px 11px; background: rgba(241,238,230,.9); backdrop-filter: blur(13px); }
        .sc-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: transparent; color: #969d90; font-size: 9px; font-weight: 800; }
        .sc-nav-item[data-active="true"] { color: var(--navy); }
        .sc-nav-item svg { width: 17px; height: 17px; }
        .sc-nav-item[data-active="true"] svg { color: var(--olive); }
        .sc-toast { position: fixed; z-index: 10; left: 50%; bottom: 21px; transform: translateX(-50%); border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 10px 14px; background: var(--navy); color: #f1eee6; box-shadow: 0 10px 25px rgba(12,29,58,.2); font-size: 10px; font-weight: 800; animation: sc-rise .2s ease both; white-space: nowrap; }
        @media (min-width: 500px) {
          .sc-shell { padding: 27px 24px 34px; }
          .sc-bottom-nav { margin-left: -24px; margin-right: -24px; padding-right: 24px; padding-left: 24px; }
          .sc-destination { min-height: 155px; }
        }
      `}</style>

      <div className="sc-shell">
        <header className="sc-header sc-appear">
          <div className="sc-brand">
            <div className="sc-brand-mark" aria-hidden="true"><Compass /></div>
            <div>
              <div className="sc-brand-name">safferni</div>
              <div className="sc-brand-label">Trip command</div>
            </div>
          </div>
          <div className="sc-header-actions">
            <button className="sc-icon-btn" type="button" onClick={() => setShowSearch((current) => !current)} aria-label="Search destinations">
              <Search />
            </button>
            <button className="sc-icon-btn" type="button" onClick={() => announce("Profile is ready to personalise")} aria-label="Open profile">
              <UserRound />
            </button>
          </div>
        </header>

        <section className="sc-welcome sc-appear sc-delay-1">
          <div>
            <div className="sc-kicker">Tuesday, 21 May · 09:42 local</div>
            <h1 className="sc-display">Your next trip,<br />in good hands.</h1>
            <p className="sc-welcome-copy">Make one clear decision at a time. Your routes, stays, and little in-between moments live here.</p>
          </div>
          <div className="sc-stamp">Travelling<strong>2</strong>people</div>
        </section>

        <section className="sc-command sc-appear sc-delay-2" aria-label="Trip command">
          <div className="sc-command-top">
            <div>
              <div className="sc-command-kicker">Trip command 01</div>
              <h2>What are we arranging?</h2>
              <p className="sc-command-copy">Choose a starting point. We will keep the useful details close and the noise out.</p>
            </div>
            <span className="sc-command-badge"><Sparkles /> Curated</span>
          </div>
          <div className="sc-plan-row">
            <button className="sc-primary" type="button" onClick={() => startPlanning()}>
              Open a new brief <ArrowUpRight />
            </button>
            <button className="sc-secondary" type="button" onClick={() => announce("Your flexible trip brief is ready")}>
              Flexible planning <ChevronRight />
            </button>
          </div>
        </section>

        <section className="sc-mode-shell sc-appear sc-delay-3" aria-label="Planning modes">
          <div className="sc-section-label"><span>Planning mode</span><span>01 / 04</span></div>
          <div className="sc-mode-grid">
            {modes.map(({ key, label, helper, icon: Icon }) => (
              <button key={key} className="sc-mode" type="button" data-active={mode === key} onClick={() => chooseMode(key)}>
                <span className="sc-mode-icon"><Icon /></span>
                <span><span className="sc-mode-name">{label}</span><span className="sc-mode-helper">{helper}</span></span>
                <CircleCheck className="sc-mode-check" />
              </button>
            ))}
          </div>
        </section>

        <section className="sc-appear sc-delay-3" aria-label="Upcoming travel">
          <div className="sc-section-head">
            <div><div className="sc-kicker">Your travel desk</div><h3>Upcoming travel</h3></div>
            <button className="sc-link" type="button" onClick={() => { setActiveTab("Trips"); announce("Opening all trips"); }}>All trips <ChevronRight /></button>
          </div>
          <div className="sc-trip-list">
            {trips.map((trip) => (
              <button
                className="sc-trip-card"
                key={trip.city}
                type="button"
                data-active={activeTrip === trip.city}
                style={{ "--trip-accent": trip.accent } as CSSProperties}
                onClick={() => openTrip(trip.city)}
              >
                <span className="sc-trip-rail" />
                <span className="sc-trip-meta">
                  <span className="sc-trip-state"><Check /> {trip.state}</span>
                  <span className="sc-trip-title">{trip.city}, {trip.country}</span>
                  <span className="sc-trip-note">{trip.note}</span>
                </span>
                <span className="sc-trip-date"><CalendarDays /> {trip.dates}</span>
                <span className="sc-trip-progress"><span className="sc-progress-track"><span className="sc-progress-fill" style={{ width: `${trip.progress}%` }} /></span><span className="sc-progress-label">{trip.progress}%</span></span>
              </button>
            ))}
          </div>
        </section>

        {showSearch && (
          <form className="sc-search sc-appear" onSubmit={submitSearch}>
            <Search />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a city, country, or feeling…" aria-label="Search destinations" />
            {query && <button className="sc-search-clear" type="button" onClick={() => setQuery("")} aria-label="Clear search"><X /></button>}
          </form>
        )}

        <section className="sc-appear sc-delay-4" aria-label="Destination ideas">
          <div className="sc-section-head">
            <div><div className="sc-kicker">Dispatches from elsewhere</div><h3>Destinations to consider</h3></div>
            <button className="sc-link" type="button" onClick={() => { setShowSearch(true); announce("Search is ready"); }}>Explore <ChevronRight /></button>
          </div>
          <div className="sc-destination-list">
            {filteredDestinations.length ? filteredDestinations.map((destination) => (
              <article className="sc-destination" key={destination.city}>
                <button className="sc-save" type="button" data-saved={saved.includes(destination.city)} onClick={() => toggleSaved(destination.city)} aria-label={`${saved.includes(destination.city) ? "Remove" : "Save"} ${destination.city}`}>
                  <Bookmark fill={saved.includes(destination.city) ? "currentColor" : "none"} />
                </button>
                <button type="button" className="sc-destination-visual" style={{ backgroundImage: destination.image }} onClick={() => startPlanning(destination.city)} aria-label={`Plan a trip to ${destination.city}`} />
                <button type="button" className="sc-destination-copy" onClick={() => startPlanning(destination.city)}>
                  <small>{destination.code} · {destination.country} · {destination.months}</small>
                  <strong>{destination.city}</strong>
                  <span>{destination.vibe} · est. {destination.budget}</span>
                </button>
              </article>
            )) : <div className="sc-empty">No destinations match that feeling. Try “coast”, “quiet”, or a city.</div>}
          </div>
        </section>

        <nav className="sc-bottom-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className="sc-nav-item" data-active={activeTab === label} type="button" onClick={() => { setActiveTab(label); announce(label === "Command" ? "You are at trip command" : `${label} view selected`); }}>
              <Icon fill={activeTab === label && label === "Saved" ? "currentColor" : "none"} />{label}
            </button>
          ))}
        </nav>
      </div>

      {toast && <div className="sc-toast" role="status">{toast}</div>}
    </main>
  );
}

export default SafferniTravelDesignB;