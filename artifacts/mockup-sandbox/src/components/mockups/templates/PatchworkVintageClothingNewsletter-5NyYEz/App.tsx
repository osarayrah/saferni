import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowUpRight, Asterisk, Scissors, Sparkles } from 'lucide-react';

const INK = '#2A241C';
const RUST = '#A1431F';
const OLIVE = '#6E6A48';
const FADE = '#8C8270';

const sections = [
  { id: 'dispatch', label: 'the dispatch', script: 'hello again' },
  { id: 'hole', label: 'hole of the week', script: 'a love letter' },
  { id: 'patina', label: 'patina report', script: 'three survivors' },
  { id: 'confessional', label: 'the confessional', script: 'sins & stains' },
];

const patinaItems = [
  {
    name: 'Levi\u2019s 517, 1978',
    price: '$148',
    story:
      'Owned by a rodeo clown named Dennis. The right knee gave out in \u201986 — same year as his marriage. Both were patched. Only one held.',
    flaw: 'sun-bleached unevenly, the way good things are',
    rotate: '-1.2deg',
    img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=700&h=520&fit=crop',
  },
  {
    name: 'Wool fisherman knit, no label',
    price: '$96',
    story:
      'Smells faintly of salt no matter how many times it\u2019s washed. We stopped trying. The ocean called dibs first.',
    flaw: 'one cuff longer than the other. asymmetry is honesty.',
    rotate: '0.8deg',
    img: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=700&h=520&fit=crop',
  },
  {
    name: 'Souvenir jacket, Osaka \u201964',
    price: '$310',
    story:
      'The embroidered tiger has lost an eye. He\u2019s seen enough. Lining repaired with a bandana by someone who clearly loved this thing.',
    flaw: 'tiger: one-eyed. still undefeated.',
    rotate: '-0.6deg',
    img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=700&h=520&fit=crop',
  },
];

const confessions = [
  {
    sin: 'I told my buyer the mustard stain was \u201ccharacter.\u201d',
    verdict: 'It was. Absolved.',
  },
  {
    sin: 'I kept the best band tee for myself and listed the medium one.',
    verdict: 'Understandable. Ten Hail Patches.',
  },
  {
    sin: 'I ironed a 70-year-old linen shirt completely flat. Removed every wrinkle.',
    verdict: 'Unforgivable. The wrinkles were the biography.',
  },
  {
    sin: 'I cried a little when the moth-eaten cardigan sold.',
    verdict: 'Correct response. Go in peace.',
  },
];

function CursorBits() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const dotX = useSpring(x, { stiffness: 900, damping: 45 });
  const dotY = useSpring(y, { stiffness: 900, damping: 45 });
  const starX = useSpring(x, { stiffness: 90, damping: 14 });
  const starY = useSpring(y, { stiffness: 90, damping: 14 });

  useEffect(() => {
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [x, y]);

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[100] hidden md:block"
        style={{ x: dotX, y: dotY, translateX: '-50%', translateY: '-50%' }}
      >
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: INK }} />
      </motion.div>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[99] hidden md:block"
        style={{ x: starX, y: starY, translateX: '12px', translateY: '14px' }}
      >
        <Asterisk className="spin-slow" size={22} strokeWidth={2.4} style={{ color: RUST }} />
      </motion.div>
    </>
  );
}

const wonkyBox = {
  borderRadius: '255px 18px 225px 18px / 18px 225px 18px 255px',
};
const wonkyBox2 = {
  borderRadius: '18px 225px 18px 255px / 255px 18px 225px 18px',
};

function SectionDispatch() {
  return (
    <div>
      <p className="script text-3xl md:text-4xl mb-3" style={{ color: RUST, transform: 'rotate(-2deg)' }}>
        dear hoarders, menders, & magpies —
      </p>
      <h1
        className="font-black uppercase leading-[0.92] tracking-tight"
        style={{ color: INK, fontSize: 'clamp(3rem, 7.5vw, 6.5rem)' }}
      >
        Nothing here
        <br />
        is perfect.
        <br />
        <span className="relative inline-block">
          That\u2019s the point.
          <svg className="absolute -bottom-3 left-0 w-full" height="14" viewBox="0 0 300 14" fill="none" preserveAspectRatio="none">
            <path d="M3 9 C 60 3, 120 13, 180 7 S 280 4, 297 9" stroke={RUST} strokeWidth="4" strokeLinecap="round" />
          </svg>
        </span>
      </h1>

      <div className="mt-12 grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-7 space-y-5 text-[17px] leading-relaxed" style={{ color: INK }}>
          <p>
            Welcome back to <em>Frayed</em>, the weekly dispatch from Loose Threads — the marketplace where
            every garment arrives pre-loved, pre-lived-in, and occasionally pre-cried-on.
          </p>
          <p>
            This week we\u2019re celebrating the Japanese idea of <strong>wabi-sabi</strong>: beauty that\u2019s
            crooked, weathered, and gloriously unfinished. The fade on a chore coat. The elbow that gave up.
            The hem your grandmother re-stitched in a thread that almost matched. <span className="script text-2xl" style={{ color: OLIVE }}>almost.</span>
          </p>
          <p>
            Fast fashion sells you a garment frozen at birth. We sell you one mid-sentence — already telling
            a story, waiting for you to write the next dumb, beautiful chapter.
          </p>
          <div
            className="border-2 px-6 py-5 mt-8 inline-block"
            style={{ ...wonkyBox, borderColor: OLIVE, transform: 'rotate(-0.7deg)' }}
          >
            <p className="script text-2xl" style={{ color: OLIVE }}>
              \u201cA wrinkle is just fabric remembering something.\u201d
            </p>
            <p className="text-xs uppercase tracking-[0.2em] mt-2" style={{ color: FADE }}>
              — overheard at the warehouse, probably
            </p>
          </div>
        </div>

        <div className="md:col-span-5">
          <div
            className="border-2 p-3 hover-tilt"
            style={{ ...wonkyBox2, borderColor: INK, transform: 'rotate(1.4deg)' }}
          >
            <img
              src="https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=700&h=820&fit=crop"
              alt="Rack of vintage clothing"
              className="w-full h-[380px] object-cover grayscale-[35%] sepia-[20%]"
              style={{ borderRadius: '14px 180px 14px 200px / 200px 14px 180px 14px' }}
            />
            <p className="script text-xl mt-3 px-2" style={{ color: RUST, transform: 'rotate(-1deg)' }}>
              the rack on Tuesday. organized by vibe, never by size.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-8 ml-4" style={{ color: FADE }}>
            <Scissors size={18} />
            <span className="text-xs uppercase tracking-[0.25em]">issue 47 · read time: one slow coffee</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHole() {
  return (
    <div>
      <p className="script text-3xl mb-2" style={{ color: OLIVE, transform: 'rotate(-1.5deg)' }}>
        feature · a weekly tribute
      </p>
      <h2 className="font-black uppercase leading-[0.95] tracking-tight" style={{ color: INK, fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)' }}>
        Hole of the Week:
        <br />
        left elbow, cashmere, 1991
      </h2>

      <div className="mt-10 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5 order-2 md:order-1">
          <div
            className="border-2 p-3"
            style={{ ...wonkyBox, borderColor: RUST, transform: 'rotate(-1.1deg)' }}
          >
            <img
              src="https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=700&h=700&fit=crop"
              alt="Worn knit sweater detail"
              className="w-full h-[360px] object-cover sepia-[25%]"
              style={{ borderRadius: '180px 14px 200px 14px / 14px 200px 14px 180px' }}
            />
          </div>
          <div className="mt-6 ml-2 space-y-2 text-sm" style={{ color: FADE }}>
            <p className="flex items-start gap-2"><span style={{ color: RUST }}>✕</span> Diameter: roughly one thumb, or two if you wiggle.</p>
            <p className="flex items-start gap-2"><span style={{ color: RUST }}>✕</span> Cause of injury: leaning on a bar in Lisbon, 2003 (alleged).</p>
            <p className="flex items-start gap-2"><span style={{ color: RUST }}>✕</span> Prognosis: visible mending, sashiko style, lavender thread.</p>
          </div>
        </div>

        <div className="md:col-span-7 order-1 md:order-2 space-y-5 text-[17px] leading-relaxed" style={{ color: INK }}>
          <p>
            Every week we honor one hole that earned its place. This week\u2019s honoree lives in the left
            elbow of a heather-grey cashmere crewneck, listed Sunday by seller <span className="underline decoration-2 underline-offset-4" style={{ textDecorationColor: RUST }}>@mothfoodvintage</span>.
          </p>
          <p>
            A hole is the garment\u2019s way of saying it was <em>used for living</em> — for leaning, reaching,
            propping up a chin during a very long meeting. New clothes have potential. Old clothes have receipts.
          </p>
          <p>
            The buyer (hi, Priya) plans to mend it visibly — bright thread, no apologies. Wabi-sabi rule
            number one: don\u2019t hide the repair. <span className="script text-2xl" style={{ color: RUST }}>frame it.</span>
          </p>
          <a
            href="#"
            className="group inline-flex items-center gap-2 border-2 px-6 py-3 mt-4 text-sm font-bold uppercase tracking-[0.18em] transition-all duration-300 hover:-rotate-1 hover:translate-x-1"
            style={{ ...wonkyBox2, borderColor: INK, color: INK }}
          >
            nominate a hole
            <ArrowUpRight size={16} className="transition-transform group-hover:rotate-45" />
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionPatina() {
  return (
    <div>
      <p className="script text-3xl mb-2" style={{ color: RUST, transform: 'rotate(1deg)' }}>
        the patina report
      </p>
      <h2 className="font-black uppercase leading-[0.95] tracking-tight" style={{ color: INK, fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)' }}>
        Three survivors,
        <br />
        listed this week
      </h2>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: FADE }}>
        Each one inspected, sniffed, and lightly interrogated by our team. Flaws documented with the
        reverence they deserve.
      </p>

      <div className="mt-12 space-y-14">
        {patinaItems.map((item, i) => (
          <div
            key={item.name}
            className={`grid md:grid-cols-12 gap-8 items-center ${i % 2 ? 'md:[direction:rtl]' : ''}`}
          >
            <div className="md:col-span-5 [direction:ltr]">
              <div
                className="border-2 p-3 hover-tilt"
                style={{
                  borderColor: i % 2 ? OLIVE : INK,
                  transform: `rotate(${item.rotate})`,
                  ...(i % 2 ? wonkyBox2 : wonkyBox),
                }}
              >
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-[280px] object-cover sepia-[20%] grayscale-[20%]"
                  style={{ borderRadius: '14px 160px 14px 160px / 160px 14px 160px 14px' }}
                />
              </div>
            </div>
            <div className="md:col-span-7 [direction:ltr]">
              <div className="flex items-baseline gap-4 flex-wrap">
                <h3 className="text-2xl font-black uppercase tracking-tight" style={{ color: INK }}>
                  {item.name}
                </h3>
                <span className="script text-3xl" style={{ color: RUST }}>{item.price}</span>
              </div>
              <p className="mt-3 text-[16px] leading-relaxed" style={{ color: INK }}>{item.story}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] border-t-2 border-dashed pt-3 inline-block pr-10" style={{ color: OLIVE, borderColor: OLIVE }}>
                documented flaw — {item.flaw}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionConfessional() {
  const [open, setOpen] = useState(0);
  return (
    <div>
      <p className="script text-3xl mb-2" style={{ color: OLIVE, transform: 'rotate(-1deg)' }}>
        the confessional
      </p>
      <h2 className="font-black uppercase leading-[0.95] tracking-tight" style={{ color: INK, fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)' }}>
        Seller sins,
        <br />
        judged fairly-ish
      </h2>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: FADE }}>
        Anonymous confessions from the community, ruled upon by our entirely unqualified tribunal. Click to
        receive the verdict.
      </p>

      <div className="mt-10 max-w-3xl">
        {confessions.map((c, i) => (
          <button
            key={i}
            onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full text-left border-b-2 py-6 group transition-colors"
            style={{ borderColor: i === confessions.length - 1 ? INK : FADE }}
          >
            <div className="flex items-start gap-4">
              <span className="script text-3xl shrink-0 leading-none mt-1" style={{ color: RUST }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1">
                <p className="text-lg font-bold transition-transform duration-300 group-hover:translate-x-1" style={{ color: INK }}>
                  \u201c{c.sin}\u201d
                </p>
                <div
                  className="overflow-hidden transition-all duration-500"
                  style={{ maxHeight: open === i ? 80 : 0, opacity: open === i ? 1 : 0 }}
                >
                  <p className="script text-2xl mt-3" style={{ color: OLIVE }}>
                    verdict: {c.verdict}
                  </p>
                </div>
              </div>
              <Sparkles
                size={18}
                className="mt-2 transition-transform duration-300"
                style={{ color: open === i ? RUST : FADE, transform: open === i ? 'rotate(90deg)' : 'none' }}
              />
            </div>
          </button>
        ))}
      </div>

      <div
        className="border-2 mt-14 px-8 py-8 max-w-2xl"
        style={{ ...wonkyBox, borderColor: RUST, transform: 'rotate(-0.5deg)' }}
      >
        <p className="script text-3xl" style={{ color: RUST }}>got something to confess?</p>
        <p className="mt-2 text-[16px]" style={{ color: INK }}>
          Reply to this email. We read everything. We forgive most things. We screenshot all things.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('dispatch');
  const contentRef = useRef(null);

  const handleNav = (id) => {
    setActive(id);
    if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full" style={{ background: '#EFE7D7', cursor: 'none' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Archivo:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          * { box-sizing: border-box; }
          body { margin: 0; }
          .frayed-root { font-family: 'Archivo', sans-serif; }
          .frayed-root, .frayed-root * { cursor: none !important; }
          @media (max-width: 767px) { .frayed-root, .frayed-root * { cursor: auto !important; } }
          .script { font-family: 'Caveat', cursive; }
          .spin-slow { animation: spinslow 9s linear infinite; }
          @keyframes spinslow { to { transform: rotate(360deg); } }
          .hover-tilt { transition: transform .45s cubic-bezier(.2,.8,.2,1); }
          .hover-tilt:hover { transform: rotate(0deg) scale(1.015) !important; }
          .nav-item { transition: all .3s ease; }
          .nav-item:hover { transform: translateX(6px) rotate(-1deg); }
          .content-scroll::-webkit-scrollbar { width: 10px; }
          .content-scroll::-webkit-scrollbar-track { background: transparent; }
          .content-scroll::-webkit-scrollbar-thumb { background: ${FADE}; border-radius: 99px; border: 3px solid #EFE7D7; }
          em { font-style: italic; }
        `,
        }}
      />
      <CursorBits />

      <div className="frayed-root flex flex-col md:flex-row md:h-screen">
        {/* SIDEBAR */}
        <aside
          className="md:w-[300px] lg:w-[340px] shrink-0 border-b-2 md:border-b-0 md:border-r-2 flex flex-col justify-between p-8 md:p-10"
          style={{ borderColor: INK }}
        >
          <div>
            <div className="flex items-start gap-3">
              <div>
                <p className="script text-2xl leading-none" style={{ color: RUST, transform: 'rotate(-3deg)' }}>
                  loose threads presents
                </p>
                <h1 className="font-black uppercase tracking-tight text-5xl mt-1 leading-none" style={{ color: INK }}>
                  Frayed<span style={{ color: RUST }}>*</span>
                </h1>
                <p className="text-[11px] uppercase tracking-[0.3em] mt-3" style={{ color: FADE }}>
                  issue № 47 — the wabi-sabi one
                </p>
              </div>
            </div>

            <nav className="mt-12 space-y-1">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleNav(s.id)}
                  className="nav-item w-full text-left py-3 border-b border-dashed flex items-baseline gap-3"
                  style={{ borderColor: FADE }}
                >
                  <span className="script text-xl w-7 shrink-0" style={{ color: active === s.id ? RUST : FADE }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="uppercase font-bold tracking-[0.12em] text-sm"
                    style={{
                      color: active === s.id ? INK : FADE,
                      textDecoration: active === s.id ? 'underline' : 'none',
                      textDecorationColor: RUST,
                      textDecorationThickness: 3,
                      textUnderlineOffset: 6,
                    }}
                  >
                    {s.label}
                  </span>
                  {active === s.id && (
                    <span className="script text-lg ml-auto" style={{ color: OLIVE, transform: 'rotate(-4deg)' }}>
                      {s.script}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-12 md:mt-0">
            <div
              className="border-2 px-5 py-4"
              style={{ ...wonkyBox2, borderColor: OLIVE, transform: 'rotate(-1deg)' }}
            >
              <p className="script text-xl leading-snug" style={{ color: OLIVE }}>
                forwarded by a friend with great taste?
              </p>
              <a
                href="#"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] underline underline-offset-4 decoration-2"
                style={{ color: INK, textDecorationColor: RUST }}
              >
                join 41,209 magpies <ArrowUpRight size={13} />
              </a>
            </div>
            <p className="text-[10px] uppercase tracking-[0.25em] mt-6" style={{ color: FADE }}>
              sent weekly · slightly crooked on purpose
            </p>
          </div>
        </aside>

        {/* CONTENT */}
        <main ref={contentRef} className="content-scroll flex-1 md:overflow-y-auto">
          <div className="max-w-5xl px-8 md:px-14 lg:px-20 py-14 md:py-20">
            {active === 'dispatch' && <SectionDispatch />}
            {active === 'hole' && <SectionHole />}
            {active === 'patina' && <SectionPatina />}
            {active === 'confessional' && <SectionConfessional />}

            {/* footer */}
            <footer className="mt-24 pt-8 border-t-2 flex flex-wrap items-end justify-between gap-6" style={{ borderColor: INK }}>
              <div>
                <p className="script text-3xl" style={{ color: RUST, transform: 'rotate(-2deg)' }}>
                  wear it crooked. mend it loud.
                </p>
                <p className="text-xs uppercase tracking-[0.22em] mt-2" style={{ color: FADE }}>
                  © 1997-ish — Loose Threads Vintage Marketplace · Portland / Osaka / your aunt\u2019s attic
                </p>
              </div>
              <div className="flex gap-5 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: INK }}>
                <a href="#" className="underline underline-offset-4 decoration-2 hover:rotate-2 inline-block transition-transform" style={{ textDecorationColor: OLIVE }}>unsubscribe (rude)</a>
                <a href="#" className="underline underline-offset-4 decoration-2 hover:-rotate-2 inline-block transition-transform" style={{ textDecorationColor: RUST }}>shop the issue</a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}