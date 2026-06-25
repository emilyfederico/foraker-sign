import { Link } from 'react-router';

import { authClient } from '@documenso/auth/client';

import { ContractChat } from '~/components/general/contract-chat';

// Branded post-login landing for Foraker Sign. The app header is hidden for this
// route (see _layout.tsx hideHeader) so the hero is a full-bleed takeover; the
// buttons/nav launch agents into the app.
const CSS = `
  .fk{--ink:#1c1c1c;--cream:#f6f2ea;--paper:#fbf9f5;--gold:#bda05a;--muted:#8d8579;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);
      line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
  .fk *{box-sizing:border-box;}
  .fk .serif{font-family:"Iowan Old Style","Palatino Linotype",Georgia,"Times New Roman",serif;}
  @keyframes fkup{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:none;}}
  .fk .up{animation:fkup .9s cubic-bezier(.2,.7,.2,1) both;}
  .fk .d1{animation-delay:.15s;}.fk .d2{animation-delay:.3s;}.fk .d3{animation-delay:.45s;}.fk .d4{animation-delay:.6s;}

  .fk .hero{position:relative;min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;
      padding:clamp(20px,3.5vw,42px);color:#fff;
      background:linear-gradient(180deg,rgba(18,18,18,.66)0%,rgba(18,18,18,.14)32%,rgba(18,18,18,.22)55%,rgba(18,18,18,.84)100%),
      url('/foraker-team.jpg');background-size:cover;background-position:center 28%;}
  .fk .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;}
  .fk .mark{display:flex;align-items:center;gap:12px;text-decoration:none;}
  .fk .crest{width:34px;height:34px;border:1.5px solid rgba(255,255,255,.7);border-radius:50%;
      display:flex;align-items:center;justify-content:center;color:#fff;}
  .fk .wordmark{line-height:1;}
  .fk .wordmark b{display:block;font-weight:600;letter-spacing:.32em;font-size:18px;color:#fff;}
  .fk .wordmark .sm{display:block;margin-top:3px;font-size:8.5px;letter-spacing:.5em;color:rgba(255,255,255,.75);}
  .fk .nav{display:flex;gap:26px;font-size:13px;letter-spacing:.04em;align-items:center;}
  .fk .nav a{color:rgba(255,255,255,.85);text-decoration:none;}
  .fk .nav a:hover{color:#fff;}
  .fk .nav .signout{background:none;border:1px solid rgba(255,255,255,.4);border-radius:999px;
      padding:7px 16px;font:inherit;font-size:13px;letter-spacing:.04em;color:rgba(255,255,255,.85);cursor:pointer;}
  .fk .nav .signout:hover{background:rgba(255,255,255,.12);color:#fff;}
  .fk .hero-foot{max-width:820px;}
  .fk .eyebrow{font-size:12px;letter-spacing:.42em;color:var(--gold);font-weight:600;margin-bottom:18px;}
  .fk .hl{font-size:clamp(38px,6.6vw,82px);line-height:1.02;font-weight:600;letter-spacing:-.01em;margin:0;color:#fff;}
  .fk .sub{margin:22px 0 30px;font-size:clamp(15px,1.5vw,19px);color:rgba(255,255,255,.9);max-width:620px;}
  .fk .btns{display:flex;flex-wrap:wrap;gap:14px;}
  .fk .btn{display:inline-block;padding:15px 30px;border-radius:999px;font-size:14px;font-weight:600;
      letter-spacing:.03em;text-decoration:none;transition:.2s;cursor:pointer;}
  .fk .btn-g{background:var(--gold);color:#1c1c1c;}
  .fk .btn-g:hover{background:#cdb06b;transform:translateY(-1px);}
  .fk .btn-o{border:1.5px solid rgba(255,255,255,.55);color:#fff;}
  .fk .btn-o:hover{background:rgba(255,255,255,.12);}

  .fk .values{background:var(--paper);padding:clamp(56px,8vw,108px) clamp(20px,5vw,80px);}
  .fk .vhead{max-width:1100px;margin:0 auto 56px;}
  .fk .vhead .k{font-size:12px;letter-spacing:.4em;color:var(--gold);font-weight:600;}
  .fk .vhead h2{font-size:clamp(28px,3.6vw,44px);font-weight:600;letter-spacing:-.01em;margin:14px 0 0;max-width:20ch;}
  .fk .grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(24px,3vw,48px);}
  .fk .card{border-top:2px solid var(--gold);padding-top:24px;}
  .fk .card .n{font-size:13px;letter-spacing:.2em;color:var(--gold);font-weight:600;}
  .fk .card h3{font-size:21px;font-weight:600;margin:12px 0 10px;}
  .fk .card p{margin:0;color:#5b554b;font-size:15px;}
  @media(max-width:760px){.fk .grid{grid-template-columns:1fr;}}

  .fk .quote{background:var(--cream);padding:clamp(56px,9vw,120px) clamp(20px,6vw,80px);text-align:center;}
  .fk .quote p{max-width:960px;margin:0 auto;font-size:clamp(22px,3.2vw,38px);line-height:1.3;font-weight:500;letter-spacing:-.01em;}
  .fk .quote .by{margin-top:26px;font-size:13px;letter-spacing:.3em;color:var(--muted);text-transform:uppercase;}

  .fk .cta{background:var(--ink);color:#fff;padding:clamp(64px,9vw,120px) 24px;text-align:center;}
  .fk .cta h2{font-size:clamp(30px,4.4vw,56px);font-weight:600;letter-spacing:-.01em;margin:0 0 14px;color:#fff;}
  .fk .cta p{color:rgba(255,255,255,.7);max-width:560px;margin:0 auto 34px;font-size:16px;}

  .fk .foot{background:#141414;color:rgba(255,255,255,.55);padding:30px clamp(20px,5vw,80px);
      display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;font-size:12.5px;letter-spacing:.04em;}
  .fk .foot .fm{color:rgba(255,255,255,.8);letter-spacing:.28em;font-weight:600;}
`;

export default function HomePage() {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="fk">
        <section className="hero">
          <div className="topbar up">
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

          <div className="hero-foot">
            <h1 className="hl serif up d2">
              Contracts,
              <br />
              done in minutes.
            </h1>
            <p className="sub up d3">
              Start a new loop and your contract opens pre&#8209;filled &mdash; fill it on screen,
              check the boxes, and send it for signature.
            </p>
            <div className="btns up d4">
              <Link className="btn btn-g" to="/loops">
                New loop
              </Link>
              <Link className="btn btn-o" to="/properties">
                Browse properties
              </Link>
            </div>
          </div>
        </section>

        <section className="values">
          <div className="vhead">
            <div className="k">WHY FORAKER SIGN</div>
            <h2 className="serif">Everything you need to write a contract &mdash; fast.</h2>
          </div>
          <div className="grid">
            <div className="card">
              <div className="n">01</div>
              <h3 className="serif">Start in seconds</h3>
              <p>
                Search a property or type an address and the contract opens pre&#8209;filled &mdash;
                price, address, county, and buyer already in place.
              </p>
            </div>
            <div className="card">
              <div className="n">02</div>
              <h3 className="serif">Every state form</h3>
              <p>
                The current DE, PA, and MD agreements of sale &mdash; click any blank to type, tap
                any box to check.
              </p>
            </div>
            <div className="card">
              <div className="n">03</div>
              <h3 className="serif">Fill, sign, send</h3>
              <p>
                Complete the contract on screen and send it for signature &mdash; the whole loop in
                one place, branded to Foraker.
              </p>
            </div>
          </div>
        </section>

        <section className="quote">
          <p className="serif">Less time on paperwork. More time with your clients.</p>
          <div className="by">Foraker Sign</div>
        </section>

        <section className="cta">
          <h2 className="serif">Write your next contract in under a minute.</h2>
          <p>Start a new loop and generate a contract pre-filled from the property.</p>
          <Link className="btn btn-g" to="/loops">
            Start a new loop
          </Link>
        </section>

        <div className="foot">
          <span className="fm">FORAKER REALTY CO</span>
          <span>Foraker Sign &middot; Delaware &middot; Pennsylvania &middot; Maryland</span>
        </div>
      </div>
      <ContractChat />
    </div>
  );
}
