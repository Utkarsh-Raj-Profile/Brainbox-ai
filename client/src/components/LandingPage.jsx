import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";

const features = [
  { icon: "↥", n: "01", title: "Bring everything together", text: "Upload PDFs and text files and build a knowledge space around the information that matters to you." },
  { icon: "⌕", n: "02", title: "Ask, don't hunt", text: "Use natural language to explore your documents. No more jumping between files and searching page by page." },
  { icon: "✳", n: "03", title: "Answers with context", text: "Get responses grounded in retrieved passages from your selected documents, with source context to help you verify." },
];

const steps = [
  ["01", "Add your documents", "Bring your PDFs and text notes into one personal library."],
  ["02", "Choose your sources", "Search across your processed library or select the files you want to use."],
  ["03", "Start a conversation", "Ask questions, explore ideas, and revisit your saved conversations."],
];

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".bb-reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("bb-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("bb-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function Brand() {
  return <a className="bb-brand" href="#home" aria-label="BrainBox AI home"><span className="bb-brand-mark">B</span><span>BrainBox<span className="bb-brand-ai">AI</span></span></a>;
}

export default function LandingPage({ onGetStarted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef(null);
  useReveal();

  function handlePointer(event) {
    if (!heroRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroRef.current.style.setProperty("--mx", `${x * 18}px`);
    heroRef.current.style.setProperty("--my", `${y * 18}px`);
  }

  function closeMenu() { setMenuOpen(false); }

  return (
    <main className="bb-site" id="home">
      <div className="bb-noise" aria-hidden="true" />
      <header className="bb-header">
        <nav className="bb-nav">
          <Brand />
          <button className="bb-menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}><span /><span /></button>
          <div className={`bb-nav-center ${menuOpen ? "bb-nav-open" : ""}`}>
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#workflow" onClick={closeMenu}>How it works</a>
            <a href="#why-brainbox" onClick={closeMenu}>Why BrainBox</a>
          </div>
          <div className="bb-nav-right">
            <button className="bb-nav-login" onClick={onGetStarted}>Log in</button>
            <button className="bb-nav-start" onClick={onGetStarted}>Get started <span>↗</span></button>
          </div>
        </nav>
      </header>

      <section className="bb-hero" ref={heroRef} onMouseMove={handlePointer}>
        <div className="bb-hero-grid" />
        <div className="bb-glow bb-glow-a" />
        <div className="bb-glow bb-glow-b" />
        <div className="bb-hero-inner">
          <div className="bb-hero-copy">
            <div className="bb-kicker bb-animate-in"><i /> YOUR PERSONAL AI KNOWLEDGE SPACE</div>
            <h1 className="bb-animate-in bb-delay-1">Your knowledge<br />has a <span>new interface.</span></h1>
            <p className="bb-hero-lead bb-animate-in bb-delay-2">All your documents. One intelligent workspace. Ask better questions and explore the information you already own.</p>
            <div className="bb-hero-buttons bb-animate-in bb-delay-3">
              <button className="bb-button-primary" onClick={onGetStarted}>Build your knowledge base <span>↗</span></button>
              <a className="bb-watch-link" href="#workflow"><span className="bb-play">▶</span> See how it works</a>
            </div>
            <div className="bb-hero-note bb-animate-in bb-delay-4"><span>✦</span> A clearer way to work with your own information</div>
          </div>

          <div className="bb-visual-wrap bb-animate-in bb-delay-2">
            <div className="bb-visual-aura" />
            <div className="bb-dashboard">
              <div className="bb-dash-top"><div className="bb-dash-dots"><i/><i/><i/></div><span>BrainBox AI <b>/</b> Workspace</span><div className="bb-live"><i/> PERSONAL SPACE</div></div>
              <div className="bb-dash-content">
                <aside className="bb-dash-side">
                  <div className="bb-dash-logo"><b>B</b> BrainBox</div>
                  <div className="bb-dash-nav bb-selected">▤ <span>Knowledge base</span></div>
                  <div className="bb-dash-nav">✳ <span>Ask BrainBox</span></div>
                  <small>YOUR LIBRARY</small>
                  <div className="bb-dash-file"><b>PDF</b> Research.pdf</div>
                  <div className="bb-dash-file"><b>TXT</b> Meeting notes</div>
                  <div className="bb-dash-file"><b>PDF</b> Handbook.pdf</div>
                  <div className="bb-dash-profile"><i>U</i><span>My workspace<small>Personal library</small></span></div>
                </aside>
                <div className="bb-dash-main">
                  <div className="bb-dash-heading"><div><small>YOUR KNOWLEDGE SPACE</small><h3>Ask your documents.</h3><p>Find the signal in all that information.</p></div><span className="bb-avatar">U</span></div>
                  <div className="bb-dash-upload"><div className="bb-upload-icon">↥</div><div><b>Your library is ready to grow</b><small>Drop files here or browse your computer</small></div><span className="bb-upload-plus">+</span></div>
                  <div className="bb-chat-label">A CONVERSATION</div>
                  <div className="bb-chat-user"><i>U</i><p>Can you summarize the main ideas in my research?</p></div>
                  <div className="bb-chat-ai"><i>✳</i><div><small>BRAINBOX AI</small><p>I found relevant passages across your documents. Here are the central themes, organized into a concise summary…</p><div className="bb-citation">▤ Research.pdf <span>Source</span></div></div></div>
                  <div className="bb-chat-input">Ask something about your documents… <b>↗</b></div>
                </div>
              </div>
            </div>
            <div className="bb-float bb-float-one"><span>✳</span><div><b>Answers with context</b><small>Based on your sources</small></div></div>
            <div className="bb-float bb-float-two"><span>✓</span><div><b>Your knowledge, organized</b><small>One personal workspace</small></div></div>
            <div className="bb-orbit bb-orbit-one" /><div className="bb-orbit bb-orbit-two" />
          </div>
        </div>
        <div className="bb-scroll-cue"><span /> SCROLL TO EXPLORE</div>
      </section>

      <section className="bb-statement bb-reveal" id="why-brainbox">
        <p>THE PROBLEM ISN'T A LACK OF INFORMATION.</p>
        <h2>It's finding what<br /><em>actually matters.</em></h2>
        <span>BrainBox AI helps turn your personal documents into a space you can explore through conversation.</span>
      </section>

      <section className="bb-features" id="features">
        <div className="bb-section-head bb-reveal"><div><span className="bb-overline">A BETTER WAY TO THINK WITH YOUR FILES</span><h2>Information in.<br /><em>Clarity out.</em></h2></div><p>Less time digging through documents. More time understanding what's inside them.</p></div>
        <div className="bb-feature-grid">
          {features.map((item) => <article className="bb-feature-card bb-reveal" key={item.n}><div className="bb-feature-meta"><span>{item.icon}</span><small>{item.n}</small></div><h3>{item.title}</h3><p>{item.text}</p><div className="bb-card-line" /></article>)}
        </div>
      </section>

      <section className="bb-workflow" id="workflow">
        <div className="bb-workflow-intro bb-reveal"><span className="bb-overline">THREE STEPS. A WHOLE NEW WORKFLOW.</span><h2>From scattered files<br />to <em>connected thinking.</em></h2><p>Getting started is simple. Your knowledge stays yours; BrainBox gives you a more useful way to interact with it.</p><button className="bb-button-primary" onClick={onGetStarted}>Start exploring <span>↗</span></button></div>
        <div className="bb-step-list">{steps.map(([n,title,desc])=><article className="bb-step bb-reveal" key={n}><span className="bb-step-number">{n}</span><div><h3>{title}</h3><p>{desc}</p></div><span className="bb-step-arrow">↗</span></article>)}</div>
      </section>

      <section className="bb-quote-band bb-reveal"><div className="bb-quote-mark">“</div><p>Your files hold the information.<br /><em>BrainBox helps you find the insight.</em></p><span>MEET YOUR PERSONAL KNOWLEDGE ASSISTANT</span></section>

      <section className="bb-cta bb-reveal">
        <div className="bb-cta-stars">✦　·　✧　·　✦</div>
        <span className="bb-overline">MAKE YOUR KNOWLEDGE WORK HARDER</span>
        <h2>Ready to think<br /><em>with everything?</em></h2>
        <p>Create your space, bring in your documents, and start asking better questions.</p>
        <button className="bb-button-white" onClick={onGetStarted}>Get started with BrainBox <span>↗</span></button>
        <div className="bb-cta-orb" />
      </section>

      <footer className="bb-footer">
        <div className="bb-footer-main">
          <div className="bb-footer-brand">
            <Brand />
            <p>Your personal knowledge space.<br />Think clearly. Find answers. Keep learning.</p>
          </div>
          <div className="bb-footer-links">
            <a href="#home">Back to top <span>↑</span></a>
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <button type="button" onClick={onGetStarted}>Get started <span>↗</span></button>
          </div>
        </div>
        <div className="bb-footer-bottom">
          <small>© {new Date().getFullYear()} BrainBox AI. All rights reserved.</small>
          <span className="bb-made-by">Made with <i>♥</i> by <strong>Utkarsh Raj</strong></span>
          <small>Built for your knowledge.</small>
        </div>
      </footer>
    </main>
  );
}
