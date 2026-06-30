import { Link } from 'react-router';

import { authClient } from '@documenso/auth/client';

import { ContractChat } from '~/components/general/contract-chat';

// Branded post-login landing for Foraker Sign. The app header is hidden for this
// route (see _layout.tsx hideHeader) so this is a full-bleed takeover. The page
// leads with the core choice: write the contract yourself, or let AI draft it.
// "Create with AI" opens the floating ContractChat via a window event.
const CSS = `
  .fk{--ink:#1c1c1c;--cream:#f6f2ea;--paper:#fbf9f5;--gold:#bda05a;--gold-hi:#cdb06b;
      --muted:#8d8579;--line:#e3ddd0;--soft:#6b655a;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);
      line-height:1.55;-webkit-font-smoothing:antialiased;min-height:100vh;
      display:flex;flex-direction:column;background:var(--paper);overflow-x:hidden;}
  .fk *{box-sizing:border-box;}
  .fk .serif{font-family:"Iowan Old Style","Palatino Linotype",Georgia,"Times New Roman",serif;}
  @keyframes fkup{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}
  .fk .up{animation:fkup .8s cubic-bezier(.2,.7,.2,1) both;}
  .fk .d1{animation-delay:.1s;}.fk .d2{animation-delay:.22s;}.fk .d3{animation-delay:.34s;}.fk .d4{animation-delay:.46s;}
  @media(prefers-reduced-motion:reduce){.fk .up{animation:none;}}

  .fk .topnav{display:flex;align-items:center;justify-content:space-between;gap:16px;
      padding:22px clamp(20px,4vw,40px);}
  .fk .mark{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--ink);}
  .fk .crest{width:30px;height:30px;border:1.5px solid var(--gold);border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:15px;}
  .fk .wordmark b{display:block;font-weight:600;letter-spacing:.3em;font-size:15px;}
  .fk .wordmark .sm{display:block;margin-top:2px;font-size:8px;letter-spacing:.5em;color:var(--muted);}
  .fk .nav{display:flex;gap:22px;font-size:13px;letter-spacing:.03em;align-items:center;}
  .fk .nav a{color:var(--muted);text-decoration:none;}
  .fk .nav a:hover{color:var(--ink);}
  .fk .nav .signout{background:none;border:1px solid #cfc7b6;border-radius:999px;
      padding:6px 15px;font:inherit;font-size:13px;color:var(--soft);cursor:pointer;}
  .fk .nav .signout:hover{background:#fff;color:var(--ink);}
  @media(max-width:680px){.fk .nav a{display:none;}}

  .fk .center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
      text-align:center;padding:40px clamp(20px,5vw,40px) 50px;}
  .fk .eyebrow{font-size:11px;letter-spacing:.4em;color:var(--gold);font-weight:600;margin-bottom:18px;}
  .fk .hl{font-size:clamp(36px,6vw,58px);line-height:1.04;font-weight:600;letter-spacing:-.015em;margin:0;
      text-wrap:balance;}
  .fk .lead{margin:18px 0 34px;font-size:clamp(15px,1.7vw,18px);color:var(--soft);max-width:46ch;}
  .fk .actions{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
  .fk .btn{display:inline-flex;align-items:center;gap:9px;padding:14px 26px;border-radius:999px;
      font-size:14px;font-weight:600;letter-spacing:.02em;text-decoration:none;cursor:pointer;
      border:none;font-family:inherit;transition:.2s;}
  .fk .btn svg{width:17px;height:17px;}
  .fk .btn-gold{background:var(--gold);color:var(--ink);}
  .fk .btn-gold:hover{background:var(--gold-hi);transform:translateY(-1px);}
  .fk .btn-ghost{background:transparent;border:1.5px solid #c9c1b1;color:var(--ink);}
  .fk .btn-ghost:hover{background:#fff;border-color:var(--ink);}

  .fk .strip{border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:clamp(18px,4vw,40px);
      justify-content:center;padding:18px;font-size:12.5px;}
  .fk .strip a{display:inline-flex;align-items:center;gap:8px;color:var(--muted);text-decoration:none;
      letter-spacing:.02em;}
  .fk .strip a:hover{color:var(--ink);}
  .fk .strip svg{width:15px;height:15px;color:var(--gold);}
`;

function openAiChat() {
  window.dispatchEvent(new Event('foraker:open-contract-chat'));
}

export default function HomePage() {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="fk">
        <div className="topnav up">
          <Link to="/home" className="mark">
            <span className="crest serif">F</span>
            <span className="wordmark">
              <b className="serif">FORAKER</b>
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
          <div className="eyebrow up d1">NEW CONTRACT</div>
          <h1 className="hl serif up d2">Create a contract</h1>
          <p className="lead up d3">
            Write it yourself, or let our AI draft it from a single sentence about the deal.
          </p>
          <div className="actions up d4">
            <button type="button" className="btn btn-gold" onClick={openAiChat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
                />
              </svg>
              Create with AI
            </button>
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
