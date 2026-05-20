import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Share2, Calculator, CheckCircle2 } from "lucide-react";

const SCENES = 6;
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0, play = true }: { value: number; prefix?: string; suffix?: string; decimals?: number; play?: boolean }) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!play) {
      setDisplayed(0);
      return;
    }
    const from = 0;
    const to = value;
    const duration = 2000; // Cinematic long duration

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = from + (to - from) * ease;
      setDisplayed(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    
    // Add a slight delay for dramatic effect
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(step);
    }, 400);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, play]);

  const fmt = (n: number) => decimals === 0 ? Math.round(n).toLocaleString() : n.toFixed(decimals);

  return <span>{prefix}{fmt(displayed)}{suffix}</span>;
}

export default function Wrapped() {
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name") || "You";
  const docs = parseInt(searchParams.get("docs") || "1247", 10);
  const hours = parseInt(searchParams.get("hours") || "208", 10);
  const saved = parseInt(searchParams.get("saved") || "26000", 10);
  const emails = parseInt(searchParams.get("emails") || "3741", 10);
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  const [currentScene, setCurrentScene] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const nextScene = useCallback(() => {
    if (currentScene < SCENES - 1) {
      setCurrentScene(s => s + 1);
    }
  }, [currentScene]);

  const prevScene = useCallback(() => {
    if (currentScene > 0) {
      setCurrentScene(s => s - 1);
    }
  }, [currentScene]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        nextScene();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prevScene();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextScene, prevScene]);

  const handleTap = (e: React.MouseEvent) => {
    // Ignore clicks on buttons/links
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    const { clientX } = e;
    const { innerWidth } = window;
    if (clientX > innerWidth * 0.3) {
      nextScene();
    } else {
      prevScene();
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Animation variants
  const sceneVariants = {
    initial: { opacity: 0, scale: 0.95, filter: "blur(10px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE_OUT } },
    exit: { opacity: 0, scale: 1.05, filter: "blur(10px)", transition: { duration: 0.6, ease: EASE_OUT } }
  };

  const textVariants = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.2, ease: EASE_OUT } }
  };

  const numberVariants = {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 1, delay: 0.4, ease: EASE_OUT } }
  };

  const subtextVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 1, delay: 1.2, ease: "easeOut" as const } }
  };

  const scenes = [
    // Scene 0: Intro
    <motion.div key="scene-0" className="flex flex-col items-center justify-center h-full text-center px-6" variants={sceneVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={textVariants} className="text-[var(--gold)] text-sm font-bold tracking-[0.2em] uppercase mb-6">
        Docuplete Year in Review
      </motion.div>
      <motion.h1 variants={numberVariants} className="text-5xl md:text-7xl font-black font-['Space_Grotesk'] tracking-tight leading-tight text-white mb-6">
        {name === "You" ? "Your" : `${name}'s`}<br />
        <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-[var(--text-muted)]">{year}</span>
      </motion.h1>
      <motion.p variants={subtextVariants} className="text-xl md:text-2xl text-[var(--text-muted)] max-w-lg">
        The year you stopped chasing paperwork.
      </motion.p>
      <motion.div variants={subtextVariants} className="mt-12 text-[var(--text-muted)]/50 text-sm flex items-center gap-2 animate-pulse">
        Tap to begin <ArrowRight className="w-4 h-4" />
      </motion.div>
    </motion.div>,

    // Scene 1: Docs
    <motion.div key="scene-1" className="flex flex-col items-center justify-center h-full text-center px-6" variants={sceneVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={textVariants} className="text-2xl md:text-3xl text-[var(--text-muted)] font-medium mb-4">
        You collected
      </motion.div>
      <motion.div variants={numberVariants} className="text-7xl md:text-9xl font-black font-['Space_Grotesk'] text-white my-6 tracking-tighter drop-shadow-2xl">
        <AnimatedNumber value={docs} play={currentScene === 1} />
      </motion.div>
      <motion.div variants={subtextVariants} className="text-xl md:text-3xl font-medium text-white/90 mt-2">
        documents.
      </motion.div>
      <motion.div variants={subtextVariants} className="mt-8 text-lg text-[var(--text-muted)] max-w-md">
        Without sending a single reminder yourself.
      </motion.div>
    </motion.div>,

    // Scene 2: Hours
    <motion.div key="scene-2" className="flex flex-col items-center justify-center h-full text-center px-6" variants={sceneVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={numberVariants} className="text-7xl md:text-9xl font-black font-['Space_Grotesk'] text-[var(--blue-light)] my-6 tracking-tighter drop-shadow-[0_0_40px_rgba(59,110,248,0.3)]">
        <AnimatedNumber value={hours} play={currentScene === 2} />
      </motion.div>
      <motion.div variants={textVariants} className="text-3xl md:text-5xl font-bold text-white mb-6">
        hours back in your life.
      </motion.div>
      <motion.div variants={subtextVariants} className="mt-6 text-xl text-[var(--text-muted)] max-w-lg leading-relaxed">
        Time you spent doing actual work.<br/>(Or anything else, we won't judge).
      </motion.div>
    </motion.div>,

    // Scene 3: Money
    <motion.div key="scene-3" className="flex flex-col items-center justify-center h-full text-center px-6" variants={sceneVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={textVariants} className="text-[var(--gold)] text-sm font-bold tracking-[0.2em] uppercase mb-8">
        The ROI
      </motion.div>
      <motion.div variants={numberVariants} className="text-7xl md:text-9xl font-black font-['Space_Grotesk'] text-[var(--gold)] my-6 tracking-tighter drop-shadow-[0_0_50px_rgba(196,154,56,0.2)]">
        <AnimatedNumber value={saved} prefix="$" play={currentScene === 3} />
      </motion.div>
      <motion.div variants={textVariants} className="text-2xl md:text-4xl font-bold text-white mt-4">
        in recovered time.
      </motion.div>
      <motion.div variants={subtextVariants} className="mt-8 text-lg text-[var(--text-muted)] max-w-md">
        At your billable rate, this is what chasing paperwork would have cost you.
      </motion.div>
    </motion.div>,

    // Scene 4: Emails
    <motion.div key="scene-4" className="flex flex-col items-center justify-center h-full text-center px-6" variants={sceneVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={numberVariants} className="text-7xl md:text-9xl font-black font-['Space_Grotesk'] text-white my-6 tracking-tighter">
        <AnimatedNumber value={emails} play={currentScene === 4} />
      </motion.div>
      <motion.div variants={textVariants} className="text-2xl md:text-4xl font-bold text-white mt-4 max-w-2xl leading-tight">
        follow-up emails you never had to send.
      </motion.div>
      <motion.div variants={subtextVariants} className="mt-8 text-xl text-[var(--text-muted)] italic">
        "Just checking in on this..."
      </motion.div>
      <motion.div variants={subtextVariants} className="mt-2 text-lg text-[var(--text-muted)]/60 line-through decoration-[var(--red-loss)] decoration-2">
        Never again.
      </motion.div>
    </motion.div>,

    // Scene 5: Outro
    <motion.div key="scene-5" className="flex flex-col items-center justify-center h-full text-center px-6 w-full max-w-4xl mx-auto" variants={sceneVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={textVariants} className="mb-8">
        <svg width="64" height="64" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 4h18l6 6v22H6V4z" fill="white" opacity="0.15" />
          <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
          <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <circle cx="26" cy="28" r="5" fill="#C49A38" />
          <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
      <motion.h2 variants={numberVariants} className="text-4xl md:text-6xl font-black font-['Space_Grotesk'] text-white mb-6">
        Here's to a productive {parseInt(year) + 1}.
      </motion.h2>
      <motion.p variants={subtextVariants} className="text-xl text-[var(--text-muted)] mb-12 max-w-lg">
        You keep doing the work that matters. We'll handle the paperwork.
      </motion.p>
      
      <motion.div variants={subtextVariants} className="flex flex-col sm:flex-row gap-4 w-full max-w-md z-10 relative">
        <button 
          data-testid="button-share"
          onClick={(e) => { e.stopPropagation(); copyLink(); }}
          className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-muted)]/80 text-white font-semibold transition-colors border border-[var(--border)]"
        >
          {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Share2 className="w-5 h-5" />}
          {copied ? "Copied!" : "Copy shareable link"}
        </button>
        
        <Link 
          data-testid="link-calculator"
          to="/"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-light)] text-white font-semibold transition-colors shadow-[0_0_20px_rgba(27,79,216,0.3)]"
        >
          <Calculator className="w-5 h-5" />
          Calculate yours
        </Link>
      </motion.div>
      
      <motion.div variants={subtextVariants} className="mt-12">
        <a 
          data-testid="link-docuplete"
          href="https://docuplete.com" 
          target="_blank" 
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
        >
          docuplete.com
        </a>
      </motion.div>
    </motion.div>
  ];

  return (
    <div 
      className="fixed inset-0 w-full h-[100dvh] bg-[var(--bg-dark)] overflow-hidden cursor-pointer select-none"
      onClick={handleTap}
      data-testid="wrapped-container"
    >
      {/* Background ambient light */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--blue)]/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--gold)]/5 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* Progress Bars */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex gap-2 max-w-3xl mx-auto w-full">
        {Array.from({ length: SCENES }).map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-md">
            <motion.div 
              className="h-full bg-white rounded-full origin-left"
              initial={{ scaleX: 0 }}
              animate={{ 
                scaleX: i < currentScene ? 1 : i === currentScene ? 1 : 0,
                opacity: i === currentScene ? [0.5, 1, 0.5] : 1
              }}
              transition={{ 
                scaleX: { duration: 0.3, ease: "easeInOut" },
                opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
            />
          </div>
        ))}
      </div>

      {/* Scenes */}
      <div className="relative w-full h-full flex items-center justify-center z-10">
        <AnimatePresence mode="wait">
          {scenes[currentScene]}
        </AnimatePresence>
      </div>
      
      {/* Navigation hints (desktop only, subtle) */}
      <div className="hidden md:flex absolute inset-y-0 left-0 w-1/3 items-center px-8 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none text-white/20">
        {currentScene > 0 && <ArrowRight className="w-8 h-8 rotate-180" />}
      </div>
      <div className="hidden md:flex absolute inset-y-0 right-0 w-1/3 items-center justify-end px-8 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none text-white/20">
        {currentScene < SCENES - 1 && <ArrowRight className="w-8 h-8" />}
      </div>
    </div>
  );
}
