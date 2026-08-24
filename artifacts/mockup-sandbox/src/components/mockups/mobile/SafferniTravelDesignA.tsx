import React, { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Home,
  MessageCircle,
  Package,
  Search,
  Send,
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
  position: string;
  months: string;
  tone: string;
};

const destinations: Destination[] = [
  {
    city: "Lisbon",
    country: "Portugal",
    vibe: "Sun-washed streets",
    budget: "$1,240",
    position: "58% center",
    months: "Apr – Oct",
    tone: "sea-glass",
  },
  {
    city: "Kyoto",
    country: "Japan",
    vibe: "Quiet, considered",
    budget: "$1,860",
    position: "15% center",
    months: "Mar – May",
    tone: "moss",
  },
  {
    city: "Marrakech",
    country: "Morocco",
    vibe: "Colour after dark",
    budget: "$980",
    position: "82% center",
    months: "Oct – Apr",
    tone: "terracotta",
  },
  {
    city: "Reykjavík",
    country: "Iceland",
    vibe: "Wild at the edges",
    budget: "$1,670",
    position: "43% center",
    months: "Jun – Sep",
    tone: "mist",
  },
];

const modes: { key: Mode; label: string; icon: React.ElementType }[] = [
  { key: "flights", label: "Flights", icon: Send },
  { key: "hotels", label: "Hotels", icon: Home },
  { key: "packages", label: "Packages", icon: Package },
  { key: "general", label: "Ask Safferni", icon: MessageCircle },
];

const heroImage = "/__mockup/images/safferni-stacked-home-hero.jpg";

export function SafferniTravelDesignA() {
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
    if (query.trim()) announce(`Searching for ${query.trim()}`);
  };

  const toggleSaved = (city: string) => {
    setSaved((current) => (current.includes(city) ? current.filter((item) => item !== city) : [...current, city]));
  };

  return (
    <main className="safferni-cinematic" style={{ "--deep-navy": "#0c1d3a", "--gold": "#d9b66f", "--sage": "#a4ad91" } as React.CSSProperties}>
      <style>{`
        .safferni-cinematic, .safferni-cinematic * { box-sizing: border-box; }
        .safferni-cinematic {
          min-height: 100%;
          width: 100%;
          overflow-y: auto;
          color: #132744;
          background: #eee9dc;
          font-family: "DM Sans", "Trebuchet MS", sans-serif;
          scrollbar-color: #aaa995 transparent;
        }
        .safferni-cinematic button, .safferni-cinematic input { font: inherit; }
        .safferni-cinematic button { cursor: pointer; }
        .safferni-cinematic::-webkit-scrollbar { width: 5px; }
        .safferni-cinematic::-webkit-scrollbar-thumb { background: #aaa995; border-radius: 99px; }
        .sda-shell { max-width: 610px; margin: 0 auto; padding: 14px 14px 28px; }
        .sda-appear { animation: sda-rise .6s cubic-bezier(.2,.75,.25,1) both; }
        .sda-delay-1 { animation-delay: .07s; }
        .sda-delay-2 { animation-delay: .14s; }
        .sda-delay-3 { animation-delay: .21s; }
        .sda-delay-4 { animation-delay: .28s; }
        @keyframes sda-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .sda-display { font-family: "Playfair Display", Georgia, serif; letter-spacing: -.06em; }
        .sda-eyebrow { color: #7d886b; font-size: 9px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        .sda-hero {
          position: relative;
          min-height: 463px;
          overflow: hidden;
          border-radius: 22px;
          background: #273e50 url("/__mockup/images/safferni-stacked-home-hero.jpg") 58% center / cover no-repeat;
          box-shadow: 0 20px 46px rgba(12, 29, 58, .2);
        }
        .sda-hero:before { position: absolute; inset: 0; content: ""; background: linear-gradient(180deg, rgba(7, 22, 45, .65) 0%, rgba(10, 28, 53, .08) 43%, rgba(7, 20, 42, .91) 100%); }
        .sda-hero:after { position: absolute; inset: 0; content: ""; opacity: .13; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.34'/%3E%3C/svg%3E"); mix-blend-mode: soft-light; }
        .sda-hero-header { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; padding: 17px 16px; color: #f5efdf; }
        .sda-brand { display: flex; align-items: center; gap: 8px; }
        .sda-brand-mark { display: grid; place-items: center; width: 31px; height: 31px; border: 1px solid rgba(245, 239, 223, .28); border-radius: 11px; color: var(--gold); }
        .sda-brand-name { font-family: "Playfair Display", Georgia, serif; font-size: 20px; letter-spacing: -.045em; }
        .sda-header-actions { display: flex; gap: 7px; }
        .sda-icon-btn { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(245, 239, 223, .3); border-radius: 50%; color: #f5efdf; background: rgba(12, 29, 58, .18); transition: transform .18s ease, background-color .18s ease; }
        .sda-icon-btn:hover { transform: translateY(-1px); background: rgba(12, 29, 58, .5); }
        .sda-hero-copy { position: absolute; z-index: 1; right: 20px; bottom: 19px; left: 20px; color: #f8f1e3; }
        .sda-hero-copy .sda-eyebrow { color: #d7c07d; }
        .sda-hero h1 { max-width: 350px; margin: 9px 0 0; font-size: clamp(39px, 11vw, 64px); line-height: .9; font-weight: 400; }
        .sda-hero-intro { max-width: 260px; margin: 13px 0 0; color: rgba(248, 241, 227, .72); font-size: 12px; line-height: 1.46; }
        .sda-hero-foot { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-top: 23px; }
        .sda-time { color: rgba(248, 241, 227, .58); font-size: 9px; letter-spacing: .13em; line-height: 1.35; text-transform: uppercase; }
        .sda-time strong { display: block; margin: 2px 0; color: #f8f1e3; font-family: "Playfair Display", Georgia, serif; font-size: 19px; font-weight: 400; letter-spacing: -.04em; text-transform: none; }
        .sda-plan-button { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 145px; border: 0; border-radius: 11px; padding: 12px 13px; color: #122744; background: var(--gold); font-size: 11px; font-weight: 800; transition: transform .18s ease, background-color .18s ease; }
        .sda-plan-button:hover { transform: translateY(-2px); background: #e7cb8b; }
        .sda-plan-button svg { width: 15px; height: 15px; }
        .sda-mode-bar { display: flex; gap: 7px; overflow-x: auto; margin: -19px 10px 0; padding: 0 0 2px; position: relative; z-index: 2; scrollbar-width: none; }
        .sda-mode-bar::-webkit-scrollbar { display: none; }
        .sda-mode { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(12, 29, 58, .14); border-radius: 999px; padding: 9px 11px; color: #526078; background: #f3eee2; box-shadow: 0 7px 17px rgba(12, 29, 58, .08); font-size: 10px; font-weight: 800; transition: transform .18s ease, background-color .18s ease, color .18s ease; }
        .sda-mode:hover { transform: translateY(-1px); }
        .sda-mode svg { width: 14px; height: 14px; }
        .sda-mode[data-active="true"] { border-color: var(--gold); color: #122744; background: var(--gold); }
        .sda-search { display: flex; align-items: center; gap: 9px; margin: 17px 2px 0; border: 1px solid #d2cfbf; border-radius: 12px; padding: 10px 11px; background: rgba(248, 245, 235, .75); }
        .sda-search:focus-within { border-color: #a5a981; background: #f8f5ec; }
        .sda-search > svg { width: 16px; height: 16px; color: #7d886b; }
        .sda-search input { width: 100%; border: 0; outline: 0; color: #132744; background: transparent; font-size: 12px; }
        .sda-search input::placeholder { color: #94978a; }
        .sda-search-clear { display: grid; place-items: center; width: 23px; height: 23px; border: 0; border-radius: 50%; color: #536078; background: #e6e2d5; }
        .sda-search-clear svg { width: 13px; height: 13px; }
        .sda-section-head { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin: 27px 2px 11px; }
        .sda-section-head h2 { margin: 4px 0 0; color: #132744; font-family: "Playfair Display", Georgia, serif; font-size: 23px; font-weight: 400; letter-spacing: -.055em; }
        .sda-section-link { display: inline-flex; align-items: center; gap: 2px; border: 0; padding: 0 0 3px; color: #758060; background: transparent; font-size: 10px; font-weight: 800; }
        .sda-section-link svg { width: 13px; height: 13px; }
        .sda-trip { position: relative; min-height: 217px; overflow: hidden; border-radius: 17px; color: #f8f1e3; background: var(--deep-navy) url("/__mockup/images/safferni-stacked-home-hero.jpg") 50% 64% / cover no-repeat; box-shadow: 0 13px 28px rgba(12, 29, 58, .17); }
        .sda-trip:before { position: absolute; inset: 0; content: ""; background: linear-gradient(90deg, rgba(12, 29, 58, .95) 0%, rgba(12, 29, 58, .7) 46%, rgba(12, 29, 58, .18) 100%); }
        .sda-trip-content { position: relative; z-index: 1; display: flex; min-height: 217px; flex-direction: column; justify-content: space-between; padding: 15px; }
        .sda-trip-top { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
        .sda-trip-label { color: #cbd3ba; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .sda-trip-title { margin: 3px 0 0; font-family: "Playfair Display", Georgia, serif; font-size: 28px; font-weight: 400; letter-spacing: -.055em; }
        .sda-status { display: inline-flex; align-items: center; gap: 5px; border-radius: 99px; padding: 6px 8px; color: #1c342f; background: #c8d2b9; font-size: 9px; font-weight: 800; }
        .sda-status-dot { width: 5px; height: 5px; border-radius: 50%; background: #648369; }
        .sda-trip-bottom { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; }
        .sda-trip-rail { display: grid; grid-template-columns: repeat(4, auto); gap: 15px; }
        .sda-trip-stat span { display: block; color: rgba(248, 241, 227, .57); font-size: 9px; }
        .sda-trip-stat strong { display: block; margin-top: 3px; color: #f8f1e3; font-size: 10px; font-weight: 800; }
        .sda-trip-stat strong svg { vertical-align: -2px; margin-right: 2px; color: var(--gold); }
        .sda-open-trip { display: inline-flex; align-items: center; gap: 4px; border: 0; border-bottom: 1px solid rgba(217, 182, 111, .6); padding: 0 0 3px; color: var(--gold); background: transparent; font-size: 10px; font-weight: 800; }
        .sda-open-trip svg { width: 14px; height: 14px; }
        .sda-trip-meta { display: flex; align-items: center; gap: 5px; width: 100%; padding-top: 10px; border-top: 1px solid rgba(248, 241, 227, .2); color: rgba(248, 241, 227, .65); font-size: 10px; }
        .sda-trip-meta svg { width: 13px; height: 13px; color: var(--gold); }
        .sda-destination-list { display: grid; grid-template-columns: 1.08fr .92fr; grid-auto-rows: 148px; gap: 9px; }
        .sda-destination { position: relative; overflow: hidden; min-width: 0; border: 0; border-radius: 16px; padding: 0; color: #fff; text-align: left; background: #394c51; }
        .sda-destination:nth-child(2) { transform: translateY(20px); }
        .sda-destination:nth-child(3) { grid-column: span 1; }
        .sda-destination:nth-child(4) { transform: translateY(20px); }
        .sda-destination-visual { position: absolute; inset: 0; background-image: url("/__mockup/images/safferni-stacked-home-hero.jpg"); background-position: center; background-size: cover; opacity: .91; transition: transform .45s ease; }
        .sda-destination:hover .sda-destination-visual { transform: scale(1.06); }
        .sda-destination:after { position: absolute; inset: 0; content: ""; background: linear-gradient(180deg, rgba(5, 19, 41, .02) 15%, rgba(5, 19, 41, .86) 100%); }
        .sda-destination[data-tone="moss"] .sda-destination-visual { filter: sepia(.18) hue-rotate(22deg) saturate(.72); }
        .sda-destination[data-tone="terracotta"] .sda-destination-visual { filter: sepia(.26) saturate(1.35) hue-rotate(-9deg); }
        .sda-destination[data-tone="mist"] .sda-destination-visual { filter: grayscale(.18) saturate(.62) brightness(1.08); }
        .sda-destination-copy { position: absolute; z-index: 1; right: 11px; bottom: 11px; left: 11px; }
        .sda-destination-copy small { display: block; color: #e2c987; font-size: 8px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        .sda-destination-copy strong { display: block; margin-top: 3px; font-family: "Playfair Display", Georgia, serif; font-size: 20px; font-weight: 400; letter-spacing: -.055em; }
        .sda-destination-copy span { display: block; margin-top: 2px; overflow: hidden; color: rgba(255,255,255,.7); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .sda-save { position: absolute; z-index: 2; top: 9px; right: 9px; display: grid; place-items: center; width: 27px; height: 27px; border: 1px solid rgba(255,255,255,.44); border-radius: 50%; color: #fff; background: rgba(12, 29, 58, .3); }
        .sda-save[data-saved="true"] { border-color: var(--gold); color: #273c43; background: var(--gold); }
        .sda-save svg { width: 13px; height: 13px; }
        .sda-no-results { grid-column: 1 / -1; border: 1px dashed #c0c4ae; border-radius: 14px; padding: 22px; color: #737c6b; text-align: center; font-size: 12px; }
        .sda-bottom-nav { position: sticky; bottom: 0; z-index: 4; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 33px -14px -28px; border-top: 1px solid rgba(84, 101, 105, .16); padding: 10px 14px 12px; background: rgba(238, 233, 220, .9); backdrop-filter: blur(13px); }
        .sda-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; color: #98a08c; background: transparent; font-size: 9px; font-weight: 800; }
        .sda-nav-item[data-active="true"] { color: #536a50; }
        .sda-nav-item svg { width: 17px; height: 17px; }
        .sda-toast { position: fixed; z-index: 10; left: 50%; bottom: 22px; transform: translateX(-50%); width: max-content; max-width: calc(100% - 30px); border: 1px solid rgba(217, 182, 111, .25); border-radius: 999px; padding: 10px 14px; color: #f7f1e4; background: #112949; box-shadow: 0 11px 27px rgba(12, 29, 58, .23); font-size: 11px; font-weight: 800; animation: sda-rise .2s ease both; }
        @media (min-width: 640px) {
          .sda-shell { padding: 24px 24px 34px; }
          .sda-hero { min-height: 510px; }
          .sda-hero-copy { right: 28px; bottom: 26px; left: 28px; }
          .sda-bottom-nav { margin-right: -24px; margin-left: -24px; padding-right: 24px; padding-left: 24px; }
        }
      `}</style>

      <div className="sda-shell">
        <section className="sda-hero sda-appear" aria-label="Start planning">
          <header className="sda-hero-header">
            <div className="sda-brand">
              <div className="sda-brand-mark" aria-hidden="true"><Compass size={17} /></div>
              <span className="sda-brand-name">safferni</span>
            </div>
            <div className="sda-header-actions">
              <button className="sda-icon-btn" type="button" onClick={() => setShowSearch((current) => !current)} aria-label="Search destinations">
                <Search size={16} />
              </button>
              <button className="sda-icon-btn" type="button" onClick={() => announce("Profile is ready to personalise")} aria-label="Open profile">
                <UserRound size={16} />
              </button>
            </div>
          </header>
          <div className="sda-hero-copy">
            <div className="sda-eyebrow">Your travel companion</div>
            <h1 className="sda-display">Where next<br />feels right?</h1>
            <p className="sda-hero-intro">A quieter way to plan the places you have been thinking about.</p>
            <div className="sda-hero-foot">
              <div className="sda-time">Local time<strong>09:42</strong>Tuesday, 21 May</div>
              <button className="sda-plan-button" type="button" onClick={() => startPlanning()}>
                Start a new plan <ArrowUpRight />
              </button>
            </div>
          </div>
        </section>

        <div className="sda-mode-bar sda-appear sda-delay-1" aria-label="Planning modes">
          {modes.map(({ key, label, icon: Icon }) => (
            <button key={key} className="sda-mode" type="button" data-active={mode === key} onClick={() => { setMode(key); announce(`${label} mode selected`); }}>
              <Icon /> {label}
            </button>
          ))}
        </div>

        {showSearch && (
          <form className="sda-search sda-appear" onSubmit={submitSearch}>
            <Search />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations or vibes…" aria-label="Search destinations" />
            {query && (
              <button className="sda-search-clear" type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X />
              </button>
            )}
          </form>
        )}

        <section className="sda-appear sda-delay-2">
          <div className="sda-section-head">
            <div>
              <div className="sda-eyebrow">Your next chapter</div>
              <h2>Upcoming trip</h2>
            </div>
            <button className="sda-section-link" type="button" onClick={() => { setActiveTab("Trips"); announce("Opening all trips"); }}>
              All trips <ChevronRight />
            </button>
          </div>
          <article className="sda-trip">
            <div className="sda-trip-content">
              <div className="sda-trip-top">
                <div>
                  <div className="sda-trip-label">Draft itinerary · 7 nights</div>
                  <div className="sda-trip-title">Lisbon, Portugal</div>
                </div>
                <span className="sda-status"><span className="sda-status-dot" /> In progress</span>
              </div>
              <div className="sda-trip-bottom">
                <div className="sda-trip-rail">
                  <div className="sda-trip-stat"><span>Depart</span><strong>14 Jun</strong></div>
                  <div className="sda-trip-stat"><span>Travellers</span><strong>2 adults</strong></div>
                  <div className="sda-trip-stat"><span>Budget</span><strong>$1,240</strong></div>
                  <div className="sda-trip-stat"><span>Saved</span><strong><Check size={11} /> 3</strong></div>
                </div>
                <button className="sda-open-trip" type="button" onClick={() => announce("Opening Lisbon itinerary")}>Open trip <ArrowUpRight /></button>
                <div className="sda-trip-meta"><WalletCards /> Package estimate · flexible</div>
              </div>
            </div>
          </article>
        </section>

        <section className="sda-appear sda-delay-3">
          <div className="sda-section-head">
            <div>
              <div className="sda-eyebrow">Small ideas, big horizons</div>
              <h2>Find your next feeling</h2>
            </div>
            <button className="sda-section-link" type="button" onClick={() => { setShowSearch(true); announce("Search is ready"); }}>
              Explore <ChevronRight />
            </button>
          </div>
          <div className="sda-destination-list">
            {filteredDestinations.length ? filteredDestinations.map((destination) => (
              <button className="sda-destination" type="button" key={destination.city} data-tone={destination.tone} onClick={() => startPlanning(destination.city)}>
                <span className="sda-destination-visual" data-position={destination.position} style={{ backgroundPosition: destination.position }} />
                <span className="sda-save" data-saved={saved.includes(destination.city)} role="button" aria-label={`${saved.includes(destination.city) ? "Remove" : "Save"} ${destination.city}`} onClick={(event) => { event.stopPropagation(); toggleSaved(destination.city); announce(saved.includes(destination.city) ? `${destination.city} removed from saved` : `${destination.city} saved`); }}>
                  <Bookmark size={13} fill={saved.includes(destination.city) ? "currentColor" : "none"} />
                </span>
                <span className="sda-destination-copy">
                  <small>{destination.country} · {destination.months}</small>
                  <strong>{destination.city}</strong>
                  <span>{destination.vibe} · est. {destination.budget}</span>
                </span>
              </button>
            )) : (
              <div className="sda-no-results">No destinations match that feeling. Try “coast”, “quiet”, or a city.</div>
            )}
          </div>
        </section>

        <nav className="sda-bottom-nav" aria-label="Main navigation">
          {[
            { label: "Home", icon: Compass },
            { label: "Trips", icon: CalendarDays },
            { label: "Saved", icon: Bookmark },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className="sda-nav-item" data-active={activeTab === label} type="button" onClick={() => { setActiveTab(label); announce(label === "Home" ? "You are home" : `${label} view selected`); }}>
              <Icon fill={activeTab === label && label === "Saved" ? "currentColor" : "none"} />{label}
            </button>
          ))}
        </nav>
      </div>
      {toast && <div className="sda-toast" role="status">{toast}</div>}
    </main>
  );
}

export default SafferniTravelDesignA;