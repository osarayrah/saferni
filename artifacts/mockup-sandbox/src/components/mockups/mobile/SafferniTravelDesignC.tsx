import React, { useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  MapPin,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type Tab = "Home" | "Trips" | "Saved";

const heroImage = "/__mockup/images/safferni-immersive-hero.jpg";

const stops = [
  { day: "01", city: "Lisbon", detail: "Arrive softly" },
  { day: "03", city: "Sintra", detail: "Forest / fog" },
  { day: "06", city: "Cascais", detail: "Atlantic edge" },
];

export function SafferniTravelDesignC() {
  const [activeTab, setActiveTab] = useState<Tab>("Home");
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    announce(search.trim() ? `Searching for ${search.trim()}` : "Try a city, feeling, or season");
  };

  const beginPlanning = () => announce("Your Lisbon brief is ready to shape");

  return (
    <main
      className="safferni-immersive"
      style={
        {
          "--deep-navy": "#0c1d3a",
          "--ink": "#152b4a",
          "--gold": "#d9b66f",
          "--paper": "#eee9dc",
          "--sage": "#a4ad91",
        } as React.CSSProperties
      }
    >
      <style>{`
        .safferni-immersive, .safferni-immersive * { box-sizing: border-box; }
        .safferni-immersive {
          width: 100%;
          min-height: 100%;
          overflow: auto;
          color: var(--ink);
          background: var(--paper);
          font-family: "DM Sans", "Trebuchet MS", sans-serif;
          scrollbar-color: #aaa995 transparent;
        }
        .safferni-immersive button, .safferni-immersive input { font: inherit; }
        .safferni-immersive button { cursor: pointer; }
        .safferni-immersive::-webkit-scrollbar { width: 5px; }
        .safferni-immersive::-webkit-scrollbar-thumb { background: #aaa995; border-radius: 99px; }
        .sic-shell { width: min(100%, 610px); margin: 0 auto; padding: 12px 13px 26px; }
        .sic-hero {
          position: relative;
          min-height: min(730px, calc(100dvh - 24px));
          overflow: hidden;
          border-radius: 27px;
          color: #f7f0e1;
          background: var(--deep-navy);
          box-shadow: 0 24px 56px rgba(12, 29, 58, .26);
          isolation: isolate;
          animation: sic-rise .7s cubic-bezier(.2,.75,.25,1) both;
        }
        .sic-hero-image {
          position: absolute;
          inset: 0;
          z-index: -3;
          background: url("${heroImage}") 54% center / cover no-repeat;
          transform: scale(1.025);
          animation: sic-drift 15s ease-in-out infinite alternate;
        }
        .sic-hero:before {
          position: absolute;
          inset: 0;
          z-index: -2;
          content: "";
          background:
            linear-gradient(180deg, rgba(7, 19, 42, .86) 0%, rgba(8, 24, 48, .12) 31%, rgba(7, 18, 39, .16) 49%, rgba(6, 16, 36, .95) 100%),
            linear-gradient(90deg, rgba(8, 23, 46, .48), transparent 65%);
        }
        .sic-hero:after {
          position: absolute;
          inset: 0;
          z-index: -1;
          content: "";
          opacity: .16;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.32'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }
        @keyframes sic-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sic-drift { from { transform: scale(1.025) translate3d(-1%, 0, 0); } to { transform: scale(1.08) translate3d(1%, -1%, 0); } }
        @keyframes sic-pulse { 0%, 100% { transform: scale(1); opacity: .8; } 50% { transform: scale(1.18); opacity: 1; } }
        .sic-hero-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 17px;
        }
        .sic-brand { display: flex; align-items: center; gap: 8px; }
        .sic-brand-mark {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border: 1px solid rgba(247, 240, 225, .33);
          border-radius: 11px;
          color: var(--gold);
        }
        .sic-brand-name {
          color: #f7f0e1;
          font-family: "Playfair Display", Georgia, serif;
          font-size: 20px;
          letter-spacing: -.05em;
        }
        .sic-header-actions { display: flex; gap: 7px; }
        .sic-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(247, 240, 225, .3);
          border-radius: 50%;
          color: #f7f0e1;
          background: rgba(12, 29, 58, .24);
          transition: transform .18s ease, background-color .18s ease;
        }
        .sic-icon:hover { transform: translateY(-2px); background: rgba(12, 29, 58, .6); }
        .sic-search {
          position: absolute;
          z-index: 4;
          top: 62px;
          right: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(217, 182, 111, .52);
          border-radius: 13px;
          padding: 10px 11px;
          color: #f7f0e1;
          background: rgba(12, 29, 58, .84);
          box-shadow: 0 12px 24px rgba(3, 13, 30, .22);
          backdrop-filter: blur(12px);
          animation: sic-rise .25s ease both;
        }
        .sic-search svg { width: 15px; color: var(--gold); }
        .sic-search input { width: 100%; border: 0; outline: 0; color: #f7f0e1; background: transparent; font-size: 12px; }
        .sic-search input::placeholder { color: rgba(247, 240, 225, .52); }
        .sic-search-clear { display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 50%; color: #d8d1c2; background: rgba(247, 240, 225, .13); }
        .sic-search-clear svg { width: 12px; color: inherit; }
        .sic-kicker {
          position: absolute;
          top: 104px;
          left: 19px;
          color: #ddc988;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        .sic-orbit {
          position: absolute;
          top: 137px;
          right: 18px;
          left: 18px;
          height: 114px;
          border-top: 1px solid rgba(231, 205, 140, .35);
          border-radius: 50%;
          transform: rotate(-8deg);
          opacity: .75;
        }
        .sic-orbit:before, .sic-orbit:after {
          position: absolute;
          content: "";
          border: 1px solid rgba(231, 205, 140, .22);
          border-radius: 50%;
        }
        .sic-orbit:before { inset: 13px 9% 14px 9%; }
        .sic-orbit:after { inset: 29px 19% 29px 19%; }
        .sic-orbit-dot {
          position: absolute;
          top: -3px;
          right: 31%;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--gold);
          box-shadow: 0 0 0 5px rgba(217, 182, 111, .14);
          animation: sic-pulse 2.8s ease-in-out infinite;
        }
        .sic-copy {
          position: absolute;
          right: 19px;
          bottom: 124px;
          left: 19px;
        }
        .sic-display {
          margin: 11px 0 0;
          max-width: 410px;
          color: #f8f1e3;
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(46px, 14vw, 76px);
          font-weight: 400;
          letter-spacing: -.07em;
          line-height: .88;
        }
        .sic-copy-intro {
          max-width: 245px;
          margin: 18px 0 0;
          color: rgba(248, 241, 227, .72);
          font-size: 12px;
          line-height: 1.5;
        }
        .sic-route-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 23px;
          border: 1px solid rgba(248, 241, 227, .22);
          border-radius: 999px;
          padding: 7px 10px;
          color: rgba(248, 241, 227, .77);
          background: rgba(12, 29, 58, .28);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .07em;
          text-transform: uppercase;
          backdrop-filter: blur(8px);
        }
        .sic-route-chip svg { width: 12px; color: var(--gold); }
        .sic-hero-foot {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin-top: 17px;
        }
        .sic-local { color: rgba(248, 241, 227, .58); font-size: 9px; letter-spacing: .12em; line-height: 1.35; text-transform: uppercase; }
        .sic-local strong { display: block; margin: 2px 0; color: #f8f1e3; font-family: "Playfair Display", Georgia, serif; font-size: 19px; font-weight: 400; letter-spacing: -.04em; text-transform: none; }
        .sic-plan {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
          min-width: 139px;
          border: 0;
          border-radius: 11px;
          padding: 12px 12px 12px 13px;
          color: #122744;
          background: var(--gold);
          font-size: 10px;
          font-weight: 800;
          transition: transform .18s ease, background-color .18s ease;
        }
        .sic-plan:hover { transform: translateY(-2px); background: #e7cb8b; }
        .sic-plan svg { width: 15px; }
        .sic-scroll-cue {
          position: absolute;
          left: 20px;
          bottom: 22px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(248, 241, 227, .5);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .sic-scroll-cue svg { width: 13px; color: var(--gold); }
        .sic-stops {
          position: absolute;
          right: 19px;
          bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 98px;
          opacity: .84;
        }
        .sic-stop { display: flex; align-items: center; gap: 6px; color: rgba(248, 241, 227, .55); font-size: 8px; }
        .sic-stop:first-child { color: #e5d092; }
        .sic-stop:before { width: 5px; height: 5px; flex: 0 0 auto; border: 1px solid rgba(248, 241, 227, .55); border-radius: 50%; content: ""; }
        .sic-stop:first-child:before { border-color: var(--gold); background: var(--gold); }
        .sic-stop span { margin-left: auto; color: rgba(248, 241, 227, .36); font-family: "DM Mono", monospace; font-size: 7px; }
        .sic-progress { position: absolute; right: 19px; bottom: 72px; width: 98px; height: 1px; background: rgba(248, 241, 227, .22); }
        .sic-progress i { display: block; width: 38%; height: 1px; background: var(--gold); }
        .sic-section { animation: sic-rise .7s .15s cubic-bezier(.2,.75,.25,1) both; }
        .sic-section-head { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin: 28px 2px 12px; }
        .sic-eyebrow { color: #7d886b; font-size: 9px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        .sic-section-head h2 { margin: 4px 0 0; color: var(--ink); font-family: "Playfair Display", Georgia, serif; font-size: 24px; font-weight: 400; letter-spacing: -.06em; }
        .sic-link { display: inline-flex; align-items: center; gap: 2px; border: 0; padding: 0 0 3px; color: #758060; background: transparent; font-size: 10px; font-weight: 800; }
        .sic-link svg { width: 13px; }
        .sic-trip {
          position: relative;
          overflow: hidden;
          min-height: 185px;
          border-radius: 18px;
          color: #f8f1e3;
          background: var(--deep-navy);
          box-shadow: 0 14px 29px rgba(12, 29, 58, .17);
        }
        .sic-trip:before { position: absolute; inset: 0; content: ""; background: linear-gradient(105deg, rgba(12, 29, 58, .98) 4%, rgba(12, 29, 58, .69) 57%, rgba(12, 29, 58, .22) 100%), url("${heroImage}") 70% 66% / cover; }
        .sic-trip-content { position: relative; z-index: 1; display: flex; min-height: 185px; flex-direction: column; justify-content: space-between; padding: 15px; }
        .sic-trip-top { display: flex; align-items: start; justify-content: space-between; gap: 8px; }
        .sic-trip-label { color: #cbd3ba; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .sic-trip-title { margin-top: 4px; font-family: "Playfair Display", Georgia, serif; font-size: 27px; letter-spacing: -.06em; }
        .sic-status { display: inline-flex; align-items: center; gap: 5px; border-radius: 99px; padding: 6px 8px; color: #1c342f; background: #c8d2b9; font-size: 9px; font-weight: 800; }
        .sic-status:before { width: 5px; height: 5px; border-radius: 50%; background: #648369; content: ""; }
        .sic-trip-bottom { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
        .sic-trip-stats { display: flex; gap: 18px; }
        .sic-stat span { display: block; color: rgba(248, 241, 227, .54); font-size: 8px; }
        .sic-stat strong { display: block; margin-top: 3px; color: #f8f1e3; font-size: 10px; font-weight: 800; }
        .sic-trip-open { display: inline-flex; align-items: center; gap: 4px; border: 0; border-bottom: 1px solid rgba(217,182,111,.6); padding: 0 0 3px; color: var(--gold); background: transparent; font-size: 10px; font-weight: 800; }
        .sic-trip-open svg { width: 14px; }
        .sic-saved { display: inline-flex; align-items: center; gap: 7px; margin-top: 10px; border: 0; color: #7d886b; background: transparent; font-size: 10px; font-weight: 800; }
        .sic-saved svg { width: 15px; }
        .sic-saved[data-saved="true"] { color: #536a50; }
        .sic-bottom-nav {
          position: sticky;
          bottom: 0;
          z-index: 4;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin: 29px -13px -26px;
          border-top: 1px solid rgba(84, 101, 105, .16);
          padding: 10px 13px 12px;
          background: rgba(238, 233, 220, .9);
          backdrop-filter: blur(13px);
        }
        .sic-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; color: #98a08c; background: transparent; font-size: 9px; font-weight: 800; }
        .sic-nav-item[data-active="true"] { color: #536a50; }
        .sic-nav-item svg { width: 17px; height: 17px; }
        .sic-toast { position: fixed; z-index: 10; left: 50%; bottom: 22px; transform: translateX(-50%); width: max-content; max-width: calc(100% - 30px); border: 1px solid rgba(217, 182, 111, .25); border-radius: 999px; padding: 10px 14px; color: #f7f1e4; background: #112949; box-shadow: 0 11px 27px rgba(12, 29, 58, .23); font-size: 11px; font-weight: 800; animation: sic-rise .2s ease both; }
        @media (min-width: 640px) {
          .sic-shell { padding: 24px 24px 34px; }
          .sic-hero { min-height: 730px; }
          .sic-copy { right: 29px; bottom: 124px; left: 29px; }
          .sic-hero-header { padding-right: 27px; padding-left: 27px; }
          .sic-kicker { left: 29px; }
          .sic-orbit { right: 29px; left: 29px; }
          .sic-bottom-nav { margin-right: -24px; margin-left: -24px; padding-right: 24px; padding-left: 24px; }
        }
      `}</style>

      <div className="sic-shell">
        <section className="sic-hero" aria-label="Plan your next journey">
          <span className="sic-hero-image" aria-hidden="true" />
          <header className="sic-hero-header">
            <div className="sic-brand">
              <span className="sic-brand-mark" aria-hidden="true"><Compass size={17} /></span>
              <span className="sic-brand-name">safferni</span>
            </div>
            <div className="sic-header-actions">
              <button className="sic-icon" type="button" onClick={() => setShowSearch((current) => !current)} aria-label="Search destinations">
                <Search size={16} />
              </button>
              <button className="sic-icon" type="button" onClick={() => announce("Your profile is ready to personalise")} aria-label="Open profile">
                <UserRound size={16} />
              </button>
            </div>
          </header>

          {showSearch && (
            <form className="sic-search" onSubmit={submitSearch}>
              <Search aria-hidden="true" />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a place or a feeling…" aria-label="Search destinations" />
              {search && (
                <button className="sic-search-clear" type="button" onClick={() => setSearch("")} aria-label="Clear search">
                  <X />
                </button>
              )}
            </form>
          )}

          <div className="sic-kicker">A slower way to go further</div>
          <div className="sic-orbit" aria-hidden="true"><i className="sic-orbit-dot" /></div>

          <div className="sic-copy">
            <div className="sic-eyebrow" style={{ color: "#d7c07d" }}>Your next chapter</div>
            <h1 className="sic-display">Leave room<br />for wonder.</h1>
            <p className="sic-copy-intro">The best journeys begin with a feeling, not a checklist.</p>
            <span className="sic-route-chip"><MapPin size={12} /> Lisbon · Atlantic light · 7 nights</span>
            <div className="sic-hero-foot">
              <div className="sic-local">Local time<strong>09:42</strong>Tuesday, 21 May</div>
              <button className="sic-plan" type="button" onClick={beginPlanning}>Shape this journey <ArrowUpRight /></button>
            </div>
          </div>

          <div className="sic-progress" aria-hidden="true"><i /></div>
          <div className="sic-stops" aria-label="Journey route">
            {stops.map((stop) => <div className="sic-stop" key={stop.day}><b>{stop.city}</b><span>{stop.day}</span></div>)}
          </div>
          <button className="sic-scroll-cue" type="button" onClick={() => announce("Your Lisbon trip is waiting below")}>Discover <ArrowDown /></button>
        </section>

        <section className="sic-section" aria-label="Upcoming trip">
          <div className="sic-section-head">
            <div>
              <div className="sic-eyebrow">One good thing ahead</div>
              <h2>Upcoming trip</h2>
            </div>
            <button className="sic-link" type="button" onClick={() => { setActiveTab("Trips"); announce("Opening all trips"); }}>All trips <ChevronRight /></button>
          </div>
          <article className="sic-trip">
            <div className="sic-trip-content">
              <div className="sic-trip-top">
                <div>
                  <div className="sic-trip-label">Draft itinerary · 7 nights</div>
                  <div className="sic-trip-title">Lisbon, Portugal</div>
                </div>
                <span className="sic-status">In progress</span>
              </div>
              <div className="sic-trip-bottom">
                <div className="sic-trip-stats">
                  <div className="sic-stat"><span>Depart</span><strong>14 Jun</strong></div>
                  <div className="sic-stat"><span>Budget</span><strong>$1,240</strong></div>
                </div>
                <button className="sic-trip-open" type="button" onClick={() => announce("Opening Lisbon itinerary")}>Open <ArrowUpRight /></button>
              </div>
            </div>
          </article>
          <button className="sic-saved" data-saved={saved} type="button" onClick={() => { setSaved((current) => !current); announce(saved ? "Lisbon removed from saved" : "Lisbon saved for later"); }}>
            {saved ? <Check /> : <Bookmark />} {saved ? "Saved to your shortlist" : "Save this journey for later"}
          </button>
        </section>

        <nav className="sic-bottom-nav" aria-label="Main navigation">
          {[
            { label: "Home" as Tab, icon: Compass },
            { label: "Trips" as Tab, icon: CalendarDays },
            { label: "Saved" as Tab, icon: Bookmark },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className="sic-nav-item" data-active={activeTab === label} type="button" onClick={() => { setActiveTab(label); announce(label === "Home" ? "You are home" : `${label} view selected`); }}>
              <Icon fill={activeTab === label && label === "Saved" ? "currentColor" : "none"} />{label}
            </button>
          ))}
        </nav>
      </div>
      {toast && <div className="sic-toast" role="status"><Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />{toast}</div>}
    </main>
  );
}

export default SafferniTravelDesignC;