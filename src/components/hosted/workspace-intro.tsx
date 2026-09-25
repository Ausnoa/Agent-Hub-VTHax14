import Link from "next/link";
import { ArrowUpRight, Bot, GitBranch, Layers3, Orbit, Plus, Search, Settings2 } from "lucide-react";

export default function WorkspaceIntro({ authenticated = false }: { authenticated?: boolean }) {
  return <section className="atelier-workspace" aria-labelledby="atelier-title">
    <aside className="atelier-rail">
      <span className="atelier-wordmark"><Orbit size={22}/> Glorria Atelier</span>
      <span className="section-kicker">YOUR WORKSPACE</span>
      <nav aria-label="Workspace shortcuts">
        <Link href="/agents"><Layers3 size={16}/> Agent fleet <ArrowUpRight size={12}/></Link>
        <Link href="/general"><GitBranch size={16}/> Workflow composer <ArrowUpRight size={12}/></Link>
        <Link href="/discover"><Search size={16}/> ANS discovery <ArrowUpRight size={12}/></Link>
        <Link href={authenticated ? "/profile/settings" : "/login"}><Settings2 size={16}/> {authenticated ? "Profile settings" : "Account access"}<ArrowUpRight size={12}/></Link>
      </nav>
      <p>Discover a capability.<br/>Build a little team.<br/>Make room for possibility.</p>
    </aside>
    <div className="atelier-hero">
      <p className="eyebrow">{authenticated ? "YOUR HOSTED WORKSPACE" : "EXPLORE YOUR WORKSPACE"} · A2A COMPOSER</p>
      <h1 id="atelier-title">A little team.<br/><em>A lot of possibility.</em></h1>
      <p>Bring specialized agents together, shape their workflow, and follow every result from input to execution.</p>
      <div className="atelier-actions"><Link className="btn btn-primary" href="/create"><Plus size={16}/> Create an agent</Link><Link className="btn btn-secondary" href="/general"><GitBranch size={16}/> Compose workflow</Link></div>
      <div className="atelier-path" aria-label="Workspace process">
        <span><Search size={18}/><b>01</b> Discover</span><span><GitBranch size={18}/><b>02</b> Compose</span><span><Bot size={18}/><b>03</b> Run & review</span>
      </div>
    </div>
  </section>;
}
