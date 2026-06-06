import { useState, useEffect } from "react";
import { strip, ago } from "./utils.js";

const DEFAULT_SOURCES = [
  { id: "tldr",       name: "TLDR",             url: "https://tldr.tech/rss",                                color: "#4FC3F7" },
  { id: "platformer", name: "Platformer",        url: "https://www.platformer.news/feed",                     color: "#CE93D8" },
  { id: "404media",   name: "404 Media",         url: "https://www.404media.co/rss/",                         color: "#EF5350" },
  { id: "pragmatic",  name: "Pragmatic Eng.",    url: "https://newsletter.pragmaticengineer.com/feed",        color: "#FFA726" },
  { id: "techmeme",   name: "Techmeme",          url: "https://www.techmeme.com/feed.xml",                    color: "#66BB6A" },
  { id: "devto",      name: "Dev.to",            url: "https://dev.to/feed",                                  color: "#42A5F5" },
];

const K_DIS = "nd-dismissed";
const K_SRC = "nd-sources";
const K_ART = "nd-articles";

const C = {
  bg:      "#0b0d12",
  surface: "#12151c",
  border:  "#1e2230",
  accent:  "#e8874b",
  muted:   "#4a5268",
  text:    "#c8cdd8",
  bright:  "#eef0f5",
  red:     "#e05252",
};

export default function NewsDesk() {
  const [sources, setSources]         = useState(DEFAULT_SOURCES);
  const [articles, setArticles]       = useState([]);
  const [dismissed, setDismissed]     = useState(new Set());
  const [srcStatus, setSrcStatus]     = useState({});
  const [fetching, setFetching]       = useState(true);
  const [storageOk, setStorageOk]     = useState(false);
  const [activeSrc, setActiveSrc]     = useState(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [showDigest, setShowDigest]   = useState(false);
  const [summaries, setSummaries]     = useState({});
  const [summarizing, setSummarizing] = useState({});
  const [expandedId, setExpandedId]   = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [newName, setNewName]         = useState("");
  const [newUrl, setNewUrl]           = useState("");
  const [tick, setTick]               = useState(0);
  const [digest, setDigest]           = useState(null);   // [{index, reason, article}]
  const [digestLoading, setDigestLoading] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #1e2230; border-radius: 2px; }
      .nd-inp::placeholder { color: #4a5268; }
      .nd-inp:focus { border-color: #e8874b !important; }
      .nd-inp { outline: none; }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    try {
      const d = localStorage.getItem(K_DIS);
      if (d) setDismissed(new Set(JSON.parse(d)));
    } catch {}
    try {
      const s = localStorage.getItem(K_SRC);
      if (s) setSources(JSON.parse(s));
    } catch {}
    try {
      const a = localStorage.getItem(K_ART);
      if (a) { setArticles(JSON.parse(a)); setFetching(false); }
    } catch {}
    setStorageOk(true);
  }, []);

  useEffect(() => {
    if (!storageOk) return;
    let alive = true;
    setFetching(true);
    (async () => {
      const allFresh = [];
      await Promise.allSettled(sources.map(async (src) => {
        try {
          const r = await fetch(`/api/feed?url=${encodeURIComponent(src.url)}`);
          const d = await r.json();
          if (!alive) return;
          if (d.status === "ok") {
            (d.items || []).forEach(item => allFresh.push({
              id:          `${src.id}::${item.guid || item.link}`,
              sourceId:    src.id,
              sourceName:  src.name,
              sourceColor: src.color,
              title:       strip(item.title),
              link:        item.link,
              excerpt:     strip(item.description).slice(0, 700),
              content:     strip(item.description).slice(0, 2500),
              pubDate:     item.pubDate,
            }));
            setSrcStatus(p => ({ ...p, [src.id]: "ok" }));
          } else {
            setSrcStatus(p => ({ ...p, [src.id]: "error" }));
          }
        } catch {
          if (!alive) return;
          setSrcStatus(p => ({ ...p, [src.id]: "error" }));
        }
      }));
      if (!alive) return;
      setArticles(prev => {
        const map = new Map(prev.map(a => [a.id, a]));
        allFresh.forEach(a => map.set(a.id, a));
        const merged = [...map.values()]
          .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
          .slice(0, 350);
        try { localStorage.setItem(K_ART, JSON.stringify(merged)); } catch {}
        return merged;
      });
      setFetching(false);
    })();
    return () => { alive = false; };
  }, [sources, tick, storageOk]);

  const dismiss = (id) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    try { localStorage.setItem(K_DIS, JSON.stringify([...next])); } catch {}
  };

  const undismiss = (id) => {
    const next = new Set([...dismissed]); next.delete(id);
    setDismissed(next);
    try { localStorage.setItem(K_DIS, JSON.stringify([...next])); } catch {}
  };

  const summarize = async (article) => {
    if (summaries[article.id] || summarizing[article.id]) return;
    setSummarizing(p => ({ ...p, [article.id]: true }));
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: article.title, content: article.content }),
      });
      const data = await res.json();
      setSummaries(p => ({ ...p, [article.id]: data.summary || data.error || "Failed to summarize." }));
    } catch {
      setSummaries(p => ({ ...p, [article.id]: "Summary unavailable." }));
    } finally {
      setSummarizing(p => ({ ...p, [article.id]: false }));
    }
  };

  const runDigest = async () => {
    if (digestLoading) return;
    const unread = articles.filter(a => !dismissed.has(a.id));
    if (unread.length === 0) return;
    setDigestLoading(true);
    setDigest(null);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: unread }),
      });
      const data = await res.json();
      const picks = (data.picks ?? []).map(p => ({
        ...p,
        article: unread[p.index - 1],
      })).filter(p => p.article);
      setDigest(picks);
    } catch {
      setDigest([]);
    } finally {
      setDigestLoading(false);
    }
  };

  const openDigest = () => {
    setShowDigest(true);
    setActiveSrc(null);
    setShowDismissed(false);
    if (!digest && !digestLoading) runDigest();
  };

  const addSource = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const hue = (sources.length * 53 + 200) % 360;
    const src = { id: `custom-${Date.now()}`, name: newName.trim(), url: newUrl.trim(), color: `hsl(${hue},55%,65%)` };
    const next = [...sources, src];
    setSources(next);
    try { localStorage.setItem(K_SRC, JSON.stringify(next)); } catch {}
    setNewName(""); setNewUrl(""); setShowAdd(false); setTick(t => t + 1);
  };

  const removeSource = (id) => {
    const next = sources.filter(s => s.id !== id);
    setSources(next);
    try { localStorage.setItem(K_SRC, JSON.stringify(next)); } catch {}
    if (activeSrc === id) setActiveSrc(null);
  };

  const countFor = (id) => articles.filter(a => (!id || a.sourceId === id) && !dismissed.has(a.id)).length;

  const visible = articles.filter(a => {
    if (showDismissed) return dismissed.has(a.id);
    if (dismissed.has(a.id)) return false;
    if (activeSrc && a.sourceId !== activeSrc) return false;
    return true;
  });

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'JetBrains Mono',monospace", background:C.bg, color:C.text, overflow:"hidden" }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width:230, minWidth:230, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"20px 16px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:C.accent, letterSpacing:"0.2em", textTransform:"uppercase" }}>▸ rss reader</div>
            <div style={{ fontSize:21, color:C.bright, fontWeight:600, letterSpacing:"-0.03em", marginTop:3 }}>NewsDesk</div>
          </div>
          <img src="/favicon.svg" alt="" width="34" height="34" style={{ opacity:0.9, flexShrink:0 }} />
        </div>

        <nav style={{ padding:"10px 8px", flex:1, overflowY:"auto" }}>
          {/* Digest */}
          <NavItem
            active={showDigest}
            onClick={openDigest}
            color="#a78bfa" label="✦ Top 5 Digest" count={null} isSpecial
          />
          <div style={{ height:1, background:C.border, margin:"6px 8px" }} />
          <NavItem
            active={!activeSrc && !showDismissed && !showDigest}
            onClick={() => { setActiveSrc(null); setShowDismissed(false); setShowDigest(false); }}
            color={C.accent} label="All sources" count={countFor(null)} isAll
          />
          <div style={{ height:1, background:C.border, margin:"6px 8px" }} />
          {sources.map(src => (
            <NavItem
              key={src.id}
              active={activeSrc === src.id}
              onClick={() => { setActiveSrc(src.id); setShowDismissed(false); setShowDigest(false); }}
              color={src.color} label={src.name} count={countFor(src.id)}
              error={srcStatus[src.id] === "error"}
              onRemove={() => removeSource(src.id)}
            />
          ))}
          <div style={{ height:1, background:C.border, margin:"6px 8px" }} />
          <NavItem
            active={showDismissed}
            onClick={() => { setShowDismissed(true); setActiveSrc(null); setShowDigest(false); }}
            color={C.muted} label="Dismissed" count={dismissed.size}
          />
        </nav>

        <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:6 }}>
          {showAdd ? (
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <input className="nd-inp" style={inputSt} placeholder="Source name" value={newName} onChange={e => setNewName(e.target.value)} />
              <input className="nd-inp" style={inputSt} placeholder="RSS feed URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && addSource()} />
              <div style={{ display:"flex", gap:5 }}>
                <button onClick={addSource} style={{ ...btnBase, flex:1, color:C.accent, borderColor:"rgba(232,135,75,0.4)", background:"rgba(232,135,75,0.1)" }}>Add feed</button>
                <button onClick={() => { setShowAdd(false); setNewName(""); setNewUrl(""); }} style={{ ...btnBase, color:C.muted }}>✕</button>
              </div>
            </div>
          ) : (
            <GhostBtn onClick={() => setShowAdd(true)} label="+ Add RSS source" />
          )}
          <GhostBtn onClick={() => setTick(t => t + 1)} label="↻ Refresh all feeds" />
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          {showDigest ? (
            <>
              <span style={{ fontSize:11, color:"#a78bfa", background:"rgba(167,139,250,0.12)", border:"1px solid rgba(167,139,250,0.3)", padding:"3px 12px", borderRadius:20 }}>
                ✦ top 5 digest
              </span>
              {!digestLoading && digest && (
                <button onClick={runDigest} style={{ ...btnBase, fontSize:10, color:C.muted, padding:"2px 8px" }}>↻ Regenerate</button>
              )}
            </>
          ) : (
            <>
              <span style={{ fontSize:11, color:C.bright, background:"rgba(232,135,75,0.15)", border:"1px solid rgba(232,135,75,0.3)", padding:"3px 12px", borderRadius:20 }}>
                {fetching && articles.length === 0 ? "loading…" : `${countFor(activeSrc)} unread`}
              </span>
              {activeSrc && <span style={{ fontSize:11, color: sources.find(s => s.id === activeSrc)?.color }}>/ {sources.find(s => s.id === activeSrc)?.name}</span>}
              {showDismissed && <span style={{ fontSize:11, color:C.muted }}>/ dismissed</span>}
              {fetching && articles.length > 0 && <span style={{ fontSize:10, color:C.muted, animation:"pulse 1.2s ease-in-out infinite" }}>refreshing…</span>}
            </>
          )}
          <span style={{ marginLeft:"auto", fontSize:10, color:C.muted }}>articles persist until dismissed</span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
          {showDigest ? (
            <DigestPanel
              digest={digest}
              loading={digestLoading}
              dismissed={dismissed}
              summaries={summaries}
              summarizing={summarizing}
              expandedId={expandedId}
              onToggle={id => setExpandedId(expandedId === id ? null : id)}
              onSummarize={summarize}
              onDismiss={dismiss}
            />
          ) : fetching && articles.length === 0 ? (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:160, color:C.muted, fontSize:12, gap:8 }}>
              <span style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${C.border}`, borderTopColor:C.accent, display:"inline-block", animation:"spin 0.7s linear infinite" }} />
              fetching feeds…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign:"center", padding:60, color:C.muted, fontSize:12 }}>
              {showDismissed ? "Nothing dismissed yet." : "All caught up ✓"}
            </div>
          ) : visible.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              isDismissed={dismissed.has(article.id)}
              isExpanded={expandedId === article.id}
              summary={summaries[article.id]}
              isSummarizing={summarizing[article.id]}
              onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
              onSummarize={() => summarize(article)}
              onDismiss={() => dismiss(article.id)}
              onUndismiss={() => undismiss(article.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function DigestPanel({ digest, loading, dismissed, summaries, summarizing, expandedId, onToggle, onSummarize, onDismiss }) {
  if (loading) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:220, gap:12 }}>
        <span style={{ width:16, height:16, borderRadius:"50%", border:"2px solid #1e2230", borderTopColor:"#a78bfa", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
        <span style={{ fontSize:12, color:"#4a5268" }}>asking Claude to pick the best stories…</span>
      </div>
    );
  }
  if (!digest) return null;
  if (digest.length === 0) {
    return <div style={{ textAlign:"center", padding:60, color:"#4a5268", fontSize:12 }}>Could not generate digest. Try refreshing feeds first.</div>;
  }
  const visible = dismissed ? digest.filter(pick => !dismissed.has(pick.article.id)) : digest;
  if (visible.length === 0) {
    return <div style={{ textAlign:"center", padding:60, color:"#4a5268", fontSize:12 }}>All digest articles dismissed.</div>;
  }
  return (
    <div>
      <div style={{ marginBottom:18, padding:"10px 14px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:8 }}>
        <div style={{ fontSize:9, color:"#a78bfa", letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:4 }}>▸ AI-curated · top 5 from {new Date().toLocaleDateString("en-US", { month:"short", day:"numeric" })}</div>
        <div style={{ fontSize:11, color:"#4a5268", lineHeight:1.6 }}>Claude ranked these as the most impactful stories across your feeds right now.</div>
      </div>
      {visible.map((pick, i) => (
        <DigestCard
          key={pick.article.id}
          rank={i + 1}
          pick={pick}
          isExpanded={expandedId === pick.article.id}
          summary={summaries[pick.article.id]}
          isSummarizing={summarizing[pick.article.id]}
          onToggle={() => onToggle(pick.article.id)}
          onSummarize={() => onSummarize(pick.article)}
          onDismiss={() => onDismiss(pick.article.id)}
        />
      ))}
    </div>
  );
}

function DigestCard({ rank, pick, isExpanded, summary, isSummarizing, onToggle, onSummarize, onDismiss }) {
  const { article, reason } = pick;
  const [hov, setHov] = useState(false);
  const [btnHov, setBtnHov] = useState(null);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background:C.surface, borderRadius:8, marginBottom:10, overflow:"hidden", border:`1px solid ${hov ? "#2a2f42" : C.border}`, transition:"border-color 0.15s" }}
    >
      <div onClick={onToggle} style={{ padding:"14px 16px 8px", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#a78bfa", minWidth:22 }}>#{rank}</span>
          <span style={{
            fontSize:9, padding:"2px 8px", borderRadius:3, letterSpacing:"0.08em",
            textTransform:"uppercase", fontWeight:500,
            color: article.sourceColor, background:`${article.sourceColor}18`, border:`1px solid ${article.sourceColor}30`,
          }}>
            {article.sourceName}
          </span>
          <span style={{ fontSize:10, color:"#4a5268" }}>{ago(article.pubDate)}</span>
          <span style={{ marginLeft:"auto", fontSize:10, color:"#4a5268" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
        <div style={{ fontFamily:"'Bitter',Georgia,serif", fontSize:15, lineHeight:1.4, fontWeight:600, color:C.bright, marginBottom:7 }}>
          {article.title}
        </div>
        <div style={{ fontSize:11, color:"#a78bfa", lineHeight:1.55, fontStyle:"italic" }}>
          {reason}
        </div>
      </div>

      {isExpanded && article.excerpt && (
        <div style={{ padding:"0 16px 10px", fontSize:12, color:"#5d6680", lineHeight:1.75 }}>
          {article.excerpt}
        </div>
      )}

      {summary && (
        <div style={{ margin:"0 16px 12px", padding:"10px 12px", background:"rgba(232,135,75,0.06)", border:"1px solid rgba(232,135,75,0.2)", borderRadius:6 }}>
          <div style={{ fontSize:9, color:"#e8874b", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:5 }}>▸ AI Summary</div>
          <div style={{ fontSize:12, color:C.text, lineHeight:1.7 }}>{summary}</div>
        </div>
      )}

      <div style={{ padding:"6px 16px 12px", display:"flex", gap:6, alignItems:"center" }}>
        <a href={article.link} target="_blank" rel="noreferrer"
          onMouseEnter={() => setBtnHov("read")} onMouseLeave={() => setBtnHov(null)}
          style={{ ...actionBtn, color:C.text, borderColor: btnHov === "read" ? C.text : C.border, textDecoration:"none" }}>
          ↗ Read
        </a>
        <button disabled={!!summary || isSummarizing} onClick={onSummarize}
          onMouseEnter={() => setBtnHov("sum")} onMouseLeave={() => setBtnHov(null)}
          style={{ ...actionBtn, color:"#e8874b", borderColor: btnHov === "sum" && !summary && !isSummarizing ? "#e8874b" : "rgba(232,135,75,0.3)", background: btnHov === "sum" && !summary && !isSummarizing ? "rgba(232,135,75,0.1)" : "none", opacity:(!!summary || isSummarizing) ? 0.55 : 1 }}>
          {isSummarizing ? "⟳ Thinking…" : summary ? "✓ Summarized" : "✦ AI Summary"}
        </button>
        <button onClick={onDismiss}
          onMouseEnter={() => setBtnHov("dis")} onMouseLeave={() => setBtnHov(null)}
          style={{ ...actionBtn, marginLeft:"auto", color: btnHov === "dis" ? C.red : C.muted, borderColor: btnHov === "dis" ? C.red : "transparent" }}>
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, color, label, count, isAll, isSpecial, error, onRemove }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:8, padding:"7px 8px",
        borderRadius:6, cursor:"pointer", marginBottom:2,
        background: active
          ? isSpecial ? "rgba(167,139,250,0.1)" : "rgba(232,135,75,0.1)"
          : hov ? "rgba(255,255,255,0.035)" : "transparent",
        transition:"background 0.15s",
      }}
    >
      <span style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }} />
      <span style={{ fontSize:12, color: active ? (isSpecial ? "#a78bfa" : "#e8874b") : "#c8cdd8", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {label}
      </span>
      {error
        ? <span style={{ fontSize:9, color:"#e05252", flexShrink:0 }}>err</span>
        : count != null && (
          <span style={{
            fontSize:10, padding:"1px 7px", borderRadius:10, flexShrink:0,
            color: count > 0 ? (isSpecial ? "#a78bfa" : "#e8874b") : "#4a5268",
            background: count > 0 ? (isSpecial ? "rgba(167,139,250,0.15)" : "rgba(232,135,75,0.15)") : "rgba(255,255,255,0.05)",
          }}>
            {count}
          </span>
        )
      }
      {onRemove && hov && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background:"none", border:"none", color:"#e05252", cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1 }}
        >×</button>
      )}
    </div>
  );
}

function ArticleCard({ article, isDismissed, isExpanded, summary, isSummarizing, onToggle, onSummarize, onDismiss, onUndismiss }) {
  const [hov, setHov] = useState(false);
  const [btnHov, setBtnHov] = useState(null);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.surface, borderRadius:8, marginBottom:10, overflow:"hidden",
        border: `1px solid ${hov ? "#242938" : C.border}`,
        transition:"border-color 0.15s", opacity: isDismissed ? 0.55 : 1,
      }}
    >
      <div onClick={onToggle} style={{ padding:"14px 16px 8px", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
          <span style={{
            fontSize:9, padding:"2px 8px", borderRadius:3, letterSpacing:"0.08em",
            textTransform:"uppercase", fontWeight:500, flexShrink:0,
            color: article.sourceColor,
            background: `${article.sourceColor}18`,
            border: `1px solid ${article.sourceColor}30`,
          }}>
            {article.sourceName}
          </span>
          <span style={{ fontSize:10, color:"#4a5268" }}>{ago(article.pubDate)}</span>
          <span style={{ marginLeft:"auto", fontSize:10, color:"#4a5268" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
        <div style={{
          fontFamily:"'Bitter',Georgia,serif", fontSize:15, lineHeight:1.4, fontWeight:600,
          color: isDismissed ? "#4a5268" : "#eef0f5",
          textDecoration: isDismissed ? "line-through" : "none",
        }}>
          {article.title}
        </div>
      </div>

      {article.excerpt && (
        <div style={{
          padding:"0 16px 10px", fontSize:12, color:"#5d6680", lineHeight:1.75,
          display: isExpanded ? "block" : "-webkit-box",
          WebkitLineClamp: isExpanded ? "unset" : 2,
          WebkitBoxOrient:"vertical",
          overflow: isExpanded ? "visible" : "hidden",
        }}>
          {article.excerpt}
        </div>
      )}

      {summary && (
        <div style={{ margin:"0 16px 12px", padding:"10px 12px", background:"rgba(232,135,75,0.06)", border:"1px solid rgba(232,135,75,0.2)", borderRadius:6 }}>
          <div style={{ fontSize:9, color:"#e8874b", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:5 }}>▸ AI Summary</div>
          <div style={{ fontSize:12, color:"#c8cdd8", lineHeight:1.7 }}>{summary}</div>
        </div>
      )}

      <div style={{ padding:"6px 16px 12px", display:"flex", gap:6, alignItems:"center" }}>
        <a href={article.link} target="_blank" rel="noreferrer"
          onMouseEnter={() => setBtnHov("read")} onMouseLeave={() => setBtnHov(null)}
          style={{ ...actionBtn, color:"#c8cdd8", borderColor: btnHov === "read" ? "#c8cdd8" : "#1e2230", textDecoration:"none" }}>
          ↗ Read
        </a>
        <button disabled={!!summary || isSummarizing} onClick={onSummarize}
          onMouseEnter={() => setBtnHov("sum")} onMouseLeave={() => setBtnHov(null)}
          style={{ ...actionBtn, color:"#e8874b", borderColor: btnHov === "sum" && !summary && !isSummarizing ? "#e8874b" : "rgba(232,135,75,0.3)", background: btnHov === "sum" && !summary && !isSummarizing ? "rgba(232,135,75,0.1)" : "none", opacity: (!!summary || isSummarizing) ? 0.55 : 1 }}>
          {isSummarizing ? "⟳ Thinking…" : summary ? "✓ Summarized" : "✦ AI Summary"}
        </button>
        {isDismissed ? (
          <button onClick={onUndismiss}
            onMouseEnter={() => setBtnHov("restore")} onMouseLeave={() => setBtnHov(null)}
            style={{ ...actionBtn, marginLeft:"auto", color: btnHov === "restore" ? "#e8874b" : "#4a5268", borderColor: btnHov === "restore" ? "#e8874b" : "transparent" }}>
            ↩ Restore
          </button>
        ) : (
          <button onClick={onDismiss}
            onMouseEnter={() => setBtnHov("dis")} onMouseLeave={() => setBtnHov(null)}
            style={{ ...actionBtn, marginLeft:"auto", color: btnHov === "dis" ? "#e05252" : "#4a5268", borderColor: btnHov === "dis" ? "#e05252" : "transparent" }}>
            ✕ Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function GhostBtn({ onClick, label }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...btnBase, width:"100%", textAlign:"left", color: hov ? "#e8874b" : "#4a5268", borderColor: hov ? "#e8874b" : "#1e2230", transition:"all 0.15s" }}>
      {label}
    </button>
  );
}

const btnBase   = { background:"none", border:"1px solid #1e2230", color:"#4a5268", fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:"6px 10px", borderRadius:5, cursor:"pointer" };
const inputSt   = { width:"100%", background:"#0b0d12", border:"1px solid #1e2230", color:"#c8cdd8", fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:"7px 9px", borderRadius:4 };
const actionBtn = { fontFamily:"'JetBrains Mono',monospace", fontSize:10, padding:"5px 10px", borderRadius:4, cursor:"pointer", border:"1px solid", background:"none", transition:"all 0.15s" };
