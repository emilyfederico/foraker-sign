import { useState } from 'react';

import { Link } from 'react-router';

import { authClient } from '@documenso/auth/client';

import { ContractChat } from '~/components/general/contract-chat';

// Branded post-login landing for Foraker Sign. The app header is hidden for this
// route (see _layout.tsx hideHeader) so this is a full-bleed takeover. The page
// leads with the core choice: write the contract yourself, or let AI draft it.
// "Create with AI" opens the floating ContractChat via a window event.
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap');
  .fk{--navy:#15273c;--ink:#15273c;--cream:#f5f1e8;--gold:#c2a563;--gold-hi:#d6bd7d;
      --muted:rgba(245,241,232,.58);--soft:rgba(245,241,232,.74);--line:rgba(245,241,232,.14);
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--cream);
      line-height:1.55;-webkit-font-smoothing:antialiased;min-height:100vh;
      display:flex;flex-direction:column;background:var(--navy);overflow-x:hidden;}
  .fk *{box-sizing:border-box;}
  .fk .caps{font-family:"Cinzel","Iowan Old Style",Georgia,serif;}
  .fk .display{font-family:"Cormorant Garamond","Iowan Old Style",Georgia,serif;}
  @keyframes fkup{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}
  .fk .up{animation:fkup .8s cubic-bezier(.2,.7,.2,1) both;}
  .fk .d1{animation-delay:.1s;}.fk .d2{animation-delay:.22s;}.fk .d3{animation-delay:.34s;}.fk .d4{animation-delay:.46s;}
  @media(prefers-reduced-motion:reduce){.fk .up{animation:none;}}

  .fk .topnav{display:flex;align-items:center;justify-content:space-between;gap:16px;
      padding:22px clamp(20px,4vw,40px);border-bottom:1px solid var(--line);}
  .fk .mark{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--cream);}
  .fk .crest{width:32px;height:32px;border:1.5px solid var(--gold);border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--gold);}
  .fk .wordmark b{display:block;font-weight:600;letter-spacing:.26em;font-size:17px;}
  .fk .wordmark .sm{display:block;margin-top:3px;font-size:8px;letter-spacing:.46em;color:var(--muted);}
  .fk .nav{display:flex;gap:26px;font-size:13px;letter-spacing:.14em;align-items:center;}
  .fk .nav a{color:rgba(245,241,232,.78);text-decoration:none;text-transform:uppercase;}
  .fk .nav a:hover{color:var(--cream);}
  .fk .nav .signout{background:none;border:1px solid rgba(245,241,232,.32);border-radius:999px;
      padding:6px 16px;font-family:inherit;font-size:12px;letter-spacing:.12em;text-transform:uppercase;
      color:rgba(245,241,232,.78);cursor:pointer;}
  .fk .nav .signout:hover{background:rgba(245,241,232,.1);color:var(--cream);}
  @media(max-width:680px){.fk .nav a{display:none;}}

  .fk .center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
      text-align:center;padding:40px clamp(20px,5vw,40px) 50px;}
  .fk .eyebrow{font-size:12px;letter-spacing:.42em;color:var(--gold);font-weight:500;margin-bottom:18px;
      text-transform:uppercase;}
  .fk .hl{font-size:clamp(46px,8vw,84px);line-height:1.0;font-weight:600;letter-spacing:.005em;margin:0;
      text-wrap:balance;color:var(--cream);}
  .fk .lead{margin:20px 0 36px;font-size:clamp(15px,1.7vw,18px);color:var(--soft);max-width:46ch;}
  .fk .actions{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
  .fk .btn{display:inline-flex;align-items:center;gap:9px;padding:14px 28px;border-radius:999px;
      font-size:12.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;
      cursor:pointer;border:none;font-family:"Cinzel","Iowan Old Style",Georgia,serif;transition:.2s;}
  .fk .btn svg{width:16px;height:16px;}
  .fk .btn-gold,.fk .btn-ghost{background:#243b58;color:var(--cream);
      border:1.5px solid rgba(245,241,232,.22);}
  .fk .btn-gold:hover,.fk .btn-ghost:hover{background:#2d4869;border-color:rgba(245,241,232,.4);
      transform:translateY(-1px);}
  .fk .btn-gold svg{color:var(--gold);}

  .fk .strip{border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:clamp(18px,4vw,40px);
      justify-content:center;padding:18px;font-size:12px;}
  .fk .strip a{display:inline-flex;align-items:center;gap:8px;color:var(--muted);text-decoration:none;
      letter-spacing:.12em;text-transform:uppercase;font-family:"Cinzel","Iowan Old Style",Georgia,serif;}
  .fk .strip a:hover{color:var(--cream);}
  .fk .strip svg{width:15px;height:15px;color:var(--gold);}

  .fk .ask{width:100%;max-width:600px;display:flex;align-items:center;gap:12px;
      background:#f8f5ee;border-radius:999px;padding:13px 14px 13px 20px;}
  .fk .ask .plus{display:flex;color:var(--navy);}
  .fk .ask .plus svg{width:21px;height:21px;}
  .fk .ask input{flex:1;border:none;background:transparent;outline:none;font-family:inherit;
      font-size:16px;color:var(--navy);min-width:0;}
  .fk .ask input::placeholder{color:#8d887c;}
  .fk .ask .send{width:38px;height:38px;flex:none;border:none;border-radius:50%;cursor:pointer;
      background:var(--navy);color:var(--gold);display:flex;align-items:center;justify-content:center;transition:.2s;}
  .fk .ask .send:hover{background:#1d3148;}
  .fk .ask .send svg{width:19px;height:19px;}
  .fk .hint{margin:13px 0 0;font-size:12.5px;color:var(--muted);}
`;

export default function HomePage() {
  const [q, setQ] = useState('');

  // Open the floating Foraker Assistant, seeded with whatever was typed so it
  // jumps straight into building the contract. Empty input just opens the chat.
  function startAi(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    window.dispatchEvent(
      new CustomEvent('foraker:open-contract-chat', text ? { detail: { text } } : undefined),
    );
    setQ('');
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="fk">
        <div className="topnav up">
          <Link to="/home" className="mark">
            <span className="crest caps">F</span>
            <span className="wordmark caps">
              <b>FORAKER</b>
              <span className="sm">REALTY&nbsp;CO</span>
            </span>
          </Link>
          <nav className="nav">
            <Link to="/loops">Loops</Link>
            <Link to="/properties">Properties</Link>
            <Link to="/templates">Templates</Link>
            <Link to="/agent-info">My Info</Link>
            <button type="button" className="signout" onClick={() => void authClient.signOut()}>
              Sign out
            </button>
          </nav>
        </div>

        <main className="center">
          <h1 className="hl display up d2">Write an Offer</h1>

          <form className="ask up d3" onSubmit={startAi}>
            <span className="plus" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask Foraker Assistant"
              aria-label="Describe the contract you need"
            />
            <button type="submit" className="send" aria-label="Start with Foraker Assistant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          <p className="hint up d3">e.g. &ldquo;PA contract for 123 Memorial Dr, buyer Ronald Johnson&rdquo;</p>

          <div className="actions up d4">
            <Link className="btn btn-ghost" to="/loops">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4"
                />
              </svg>
              Do it manually
            </Link>
          </div>
        </main>

        <div className="strip up d4">
          <Link to="/loops">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M3 7h6l2 2h10v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              />
            </svg>
            Open loops
          </Link>
          <Link to="/loops">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5"
              />
            </svg>
            DE &middot; PA &middot; MD forms
          </Link>
          <Link to="/templates">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 5h16v4H4V5zM4 13h7v6H4v-6zM14 13h6v6h-6v-6z"
              />
            </svg>
            Templates library
          </Link>
        </div>
      </div>
      <ContractChat />
    </div>
  );
}
