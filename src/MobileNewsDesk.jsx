// src/MobileNewsDesk.jsx
// Mobile layout for NewsDesk — renders at ≤ 768 px viewport width.
// All state + handlers are passed in as props from the parent NewsDesk component.

import { useState, useEffect } from "react";

function LoadingDots() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 3), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ opacity: i <= step ? 1 : 0.2 }}>·</span>
      ))}
    </span>
  );
}
import { ago } from "./utils.js";

const getDomain = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
};

// ── Design tokens (mirrors desktop C object) ────────────────────────────────
const MC = {
  bg:     "#0b0d12",
  surf:   "#12151c",
  border: "#1e2230",
  accent: "#e8874b",
  muted:  "#4a5268",
  text:   "#c8cdd8",
  bright: "#eef0f5",
  red:    "#e05252",
  purple: "#a78bfa",
  green:  "#4ade80",
};

// ── Shared style objects ────────────────────────────────────────────────────
const mInput = {
  width: "100%", background: "#0b0d12", border: "1px solid #1e2230",
  color: "#c8cdd8", fontFamily: "'Noto Sans Nabataean', sans-serif",
  fontSize: 14, padding: "11px 13px", borderRadius: 9, outline: "none",
  boxSizing: "border-box",
};
const mBtn = {
  width: "100%", background: "none", border: "1px solid #1e2230",
  color: "#4a5268", fontFamily: "'Noto Sans Nabataean', sans-serif",
  fontSize: 13, padding: "12px 16px", borderRadius: 9, cursor: "pointer",
  textAlign: "center", boxSizing: "border-box",
};
const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "1px solid transparent",
  borderRadius: 9, cursor: "pointer", flexShrink: 0,
};
const rowBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  height: 33, padding: "0 11px", background: "transparent",
  border: "1px solid #1e2230", borderRadius: 7, cursor: "pointer",
  fontFamily: "'Noto Sans Nabataean', sans-serif", fontSize: 12,
  gap: 4, whiteSpace: "nowrap", flexShrink: 0,
};

// ── Block icon ───────────────────────────────────────────────────────────────
function BlockIcon({ size = 14, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none"
         stroke={color} strokeWidth="1.6" strokeLinecap="round"
         style={{ display: "block", flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.8" />
      <line x1="2.9" y1="2.9" x2="11.1" y2="11.1" />
    </svg>
  );
}

// ── Signal bar SVG icons ────────────────────────────────────────────────────
function SignalFull({ color }) {
  return (
    <svg width="16" height="13" viewBox="0 0 16 13" fill={color} style={{ display: "block" }}>
      <rect x="0"    y="9" width="3"   height="4"  rx="0.5" />
      <rect x="4.5"  y="6" width="3"   height="7"  rx="0.5" />
      <rect x="9"    y="3" width="3"   height="10" rx="0.5" />
      <rect x="13.5" y="0" width="2.5" height="13" rx="0.5" />
    </svg>
  );
}
function SignalLow({ color }) {
  return (
    <svg width="16" height="13" viewBox="0 0 16 13" style={{ display: "block" }}>
      <rect x="0"    y="9" width="3"   height="4"  rx="0.5" fill={color} />
      <rect x="4.5"  y="6" width="3"   height="7"  rx="0.5" fill={color} opacity="0.2" />
      <rect x="9"    y="3" width="3"   height="10" rx="0.5" fill={color} opacity="0.2" />
      <rect x="13.5" y="0" width="2.5" height="13" rx="0.5" fill={color} opacity="0.2" />
    </svg>
  );
}

// ── Like / dislike signal buttons ───────────────────────────────────────────
function MobileSignal({ isLiked, isDisliked, onLike, onDislike, onUnlike, onUndislike }) {
  const likeCol    = isLiked    ? MC.green : MC.muted;
  const dislikeCol = isDisliked ? MC.red   : MC.muted;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      <button
        onClick={isLiked ? onUnlike : onLike}
        style={{
          ...iconBtn, width: 33, height: 33,
          borderColor: isLiked ? "rgba(74,222,128,0.3)"  : "transparent",
          background:  isLiked ? "rgba(74,222,128,0.08)" : "transparent",
        }}>
        <SignalFull color={likeCol} />
      </button>
      <button
        onClick={isDisliked ? onUndislike : onDislike}
        style={{
          ...iconBtn, width: 33, height: 33,
          borderColor: isDisliked ? "rgba(224,82,82,0.3)"  : "transparent",
          background:  isDisliked ? "rgba(224,82,82,0.08)" : "transparent",
        }}>
        <SignalLow color={dislikeCol} />
      </button>
    </div>
  );
}

// ── Top app bar ─────────────────────────────────────────────────────────────
function MobileTopBar({ tab, unreadCount, fetching, onRefresh }) {
  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px",
      background: MC.surf, borderBottom: `1px solid ${MC.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <img src="/favicon.svg" alt="" width="26" height="26" style={{ opacity: 0.88, flexShrink: 0 }} />
        <span style={{
          fontSize: 19, fontWeight: 600, color: MC.bright,
          letterSpacing: "-0.03em", lineHeight: 1,
          fontFamily: "'Noto Sans Nabataean', sans-serif",
        }}>
          NewsDesk
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {tab === "feed" && (
          <span style={{
            fontSize: 11, color: MC.accent, padding: "3px 10px",
            background: "rgba(232,135,75,0.1)", border: "1px solid rgba(232,135,75,0.25)",
            borderRadius: 20, fontFamily: "'Noto Sans Nabataean', sans-serif",
          }}>
            {fetching ? "…" : `${unreadCount} unread`}
          </span>
        )}
        {tab === "digest" && (
          <span style={{
            fontSize: 11, color: MC.purple, padding: "3px 10px",
            background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 20, fontFamily: "'Noto Sans Nabataean', sans-serif",
          }}>
            ✦ digest
          </span>
        )}
        <button
          onClick={onRefresh}
          style={{
            ...iconBtn, width: 36, height: 36, fontSize: 17, fontFamily: "inherit",
            border: `1px solid ${fetching ? "rgba(232,135,75,0.3)" : MC.border}`,
            color: fetching ? MC.accent : MC.muted,
            animation: fetching ? "spin 0.8s linear infinite" : "none",
          }}>
          ↻
        </button>
      </div>
    </div>
  );
}

// ── Source filter pills (horizontal scroll) ─────────────────────────────────
function MobileSourcePills({ sources, activeSrc, showDismissed, countFor, onSelect }) {
  const allSrcs = [{ id: null, name: "All", color: MC.accent }, ...sources];
  return (
    <div style={{
      height: 48, flexShrink: 0,
      display: "flex", alignItems: "center",
      overflowX: "auto", gap: 6, padding: "0 14px",
      background: MC.surf, borderBottom: `1px solid ${MC.border}`,
      scrollbarWidth: "none", msOverflowStyle: "none",
      WebkitOverflowScrolling: "touch",
    }}>
      {allSrcs.map(src => {
        const isActive = src.id === null ? (!activeSrc && !showDismissed) : activeSrc === src.id;
        const count    = countFor(src.id);
        return (
          <button
            key={src.id ?? "__all"}
            onClick={() => onSelect(src.id)}
            style={{
              height: 28, padding: "0 12px", borderRadius: 14,
              flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: "'Noto Sans Nabataean', sans-serif", fontSize: 11,
              display: "flex", alignItems: "center", gap: 5,
              border: "1px solid",
              background: isActive ? `${src.color}1a`  : "transparent",
              borderColor: isActive ? `${src.color}55` : MC.border,
              color: isActive ? src.color : MC.muted,
            }}>
            {src.name}
            {count > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>}
          </button>
        );
      })}
      {/* Dismissed pill */}
      <button
        onClick={() => onSelect("__dismissed")}
        style={{
          height: 28, padding: "0 12px", borderRadius: 14,
          flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap",
          fontFamily: "'Noto Sans Nabataean', sans-serif", fontSize: 11,
          display: "flex", alignItems: "center",
          border: "1px solid",
          background: showDismissed ? "rgba(74,82,104,0.15)"  : "transparent",
          borderColor: showDismissed ? "rgba(74,82,104,0.45)" : MC.border,
          color: showDismissed ? MC.text : MC.muted,
        }}>
        Dismissed
      </button>
    </div>
  );
}

// ── Shared card action strip ────────────────────────────────────────────────
function CardActions({ article, isDismissed, summary, isSummarizing, isLiked, isDisliked,
                       onSummarize, onDismiss, onUndismiss, onBlock, onLike, onDislike, onUnlike, onUndislike }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "4px 12px 10px", gap: 4 }}>
      <a
        href={article.link} target="_blank" rel="noreferrer"
        style={{ ...rowBtn, color: MC.text, textDecoration: "none", borderColor: MC.border }}>
        ↗ Read
      </a>
      <button
        onClick={onSummarize}
        disabled={!!summary || isSummarizing}
        style={{
          ...rowBtn, color: MC.accent,
          borderColor: summary ? "rgba(232,135,75,0.25)" : "rgba(232,135,75,0.3)",
          background:  summary ? "rgba(232,135,75,0.06)" : "transparent",
          opacity: (!!summary || isSummarizing) ? 0.65 : 1,
          cursor: (!!summary || isSummarizing) ? "default" : "pointer",
        }}>
        {isSummarizing ? <LoadingDots /> : summary ? "✓ Done" : "✦ AI"}
      </button>
      <MobileSignal
        isLiked={isLiked} isDisliked={isDisliked}
        onLike={onLike} onDislike={onDislike}
        onUnlike={onUnlike} onUndislike={onUndislike}
      />
      <div style={{ flex: 1 }} />
      {isDismissed ? (
        <button onClick={onUndismiss}
          style={{ ...iconBtn, width: 33, height: 33, color: MC.muted, fontSize: 15, fontFamily: "inherit" }}>
          ↩
        </button>
      ) : (
        <>
          <button onClick={onBlock}
            style={{ ...iconBtn, width: 33, height: 33 }}>
            <BlockIcon size={14} color={MC.red} />
          </button>
          <button onClick={onDismiss}
            style={{ ...iconBtn, width: 33, height: 33, color: MC.muted, fontSize: 15, fontFamily: "inherit" }}>
            ✕
          </button>
        </>
      )}
    </div>
  );
}

// ── Feed article card ────────────────────────────────────────────────────────
function MobileFeedCard({ article, isDismissed, isExpanded, summary, isSummarizing,
                          isLiked, isDisliked, onToggle, onSummarize,
                          onDismiss, onUndismiss, onBlock, onLike, onDislike, onUnlike, onUndislike }) {
  return (
    <div style={{ background: MC.surf, borderBottom: `1px solid ${MC.border}`, opacity: isDismissed ? 0.55 : 1 }}>
      {/* Tap header */}
      <div onClick={onToggle} style={{ padding: "14px 16px 10px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 3,
            letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500,
            color: article.sourceColor,
            background: `${article.sourceColor}18`,
            border: `1px solid ${article.sourceColor}30`,
            flexShrink: 0, fontFamily: "'Noto Sans Nabataean', sans-serif",
          }}>
            {article.sourceName}
          </span>
          <span style={{ fontSize: 11, color: MC.muted, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
            {ago(article.pubDate)}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: MC.muted }}>
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
        <div style={{
          fontFamily: "'Bitter', Georgia, serif",
          fontSize: 16, lineHeight: 1.42, fontWeight: 600,
          color: isDismissed ? MC.muted : MC.bright,
          textDecoration: isDismissed ? "line-through" : "none",
          display: "-webkit-box", WebkitLineClamp: isExpanded ? "unset" : 3,
          WebkitBoxOrient: "vertical", overflow: isExpanded ? "visible" : "hidden",
        }}>
          {article.title}
        </div>
      </div>

      {/* Excerpt */}
      {article.excerpt && (
        <div style={{
          padding: "0 16px 10px",
          fontSize: 12, color: "#5d6680", lineHeight: 1.75,
          fontFamily: "'Noto Sans Nabataean', sans-serif",
          display: isExpanded ? "block" : "-webkit-box",
          WebkitLineClamp: isExpanded ? "unset" : 2,
          WebkitBoxOrient: "vertical", overflow: isExpanded ? "visible" : "hidden",
        }}>
          {article.excerpt}
        </div>
      )}

      {/* AI summary */}
      {summary && (
        <div style={{ margin: "0 16px 10px", padding: "10px 12px", background: "rgba(232,135,75,0.06)", border: "1px solid rgba(232,135,75,0.18)", borderRadius: 7 }}>
          <div style={{ fontSize: 9, color: MC.accent, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>▸ AI Summary</div>
          <div style={{ fontSize: 12, color: MC.text, lineHeight: 1.7, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>{summary}</div>
        </div>
      )}

      <CardActions
        article={article} isDismissed={isDismissed}
        summary={summary} isSummarizing={isSummarizing}
        isLiked={isLiked} isDisliked={isDisliked}
        onSummarize={onSummarize} onDismiss={onDismiss} onUndismiss={onUndismiss}
        onBlock={onBlock}
        onLike={onLike} onDislike={onDislike} onUnlike={onUnlike} onUndislike={onUndislike}
      />
    </div>
  );
}

// ── Digest article card ──────────────────────────────────────────────────────
function MobileDigestCard({ rank, pick, isExpanded, summary, isSummarizing,
                            isLiked, isDisliked, onToggle, onSummarize,
                            onDismiss, onBlock, onLike, onDislike, onUnlike, onUndislike }) {
  const { article, reason } = pick;
  return (
    <div style={{ background: MC.surf, borderBottom: `1px solid ${MC.border}` }}>
      <div onClick={onToggle} style={{ padding: "14px 16px 10px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: MC.purple, minWidth: 24, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>#{rank}</span>
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 500,
            color: article.sourceColor, background: `${article.sourceColor}18`,
            border: `1px solid ${article.sourceColor}30`,
            fontFamily: "'Noto Sans Nabataean', sans-serif",
          }}>
            {article.sourceName}
          </span>
          <span style={{ fontSize: 11, color: MC.muted, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>{ago(article.pubDate)}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: MC.muted }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
        <div style={{ fontFamily: "'Bitter', Georgia, serif", fontSize: 16, lineHeight: 1.42, fontWeight: 600, color: MC.bright, marginBottom: 6 }}>
          {article.title}
        </div>
        <div style={{ fontSize: 12, color: MC.purple, lineHeight: 1.55, fontStyle: "italic", fontFamily: "'Bitter', Georgia, serif" }}>
          {reason}
        </div>
      </div>
      {isExpanded && article.excerpt && (
        <div style={{ padding: "0 16px 10px", fontSize: 12, color: "#5d6680", lineHeight: 1.75, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
          {article.excerpt}
        </div>
      )}
      {summary && (
        <div style={{ margin: "0 16px 10px", padding: "10px 12px", background: "rgba(232,135,75,0.06)", border: "1px solid rgba(232,135,75,0.18)", borderRadius: 7 }}>
          <div style={{ fontSize: 9, color: MC.accent, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>▸ AI Summary</div>
          <div style={{ fontSize: 12, color: MC.text, lineHeight: 1.7, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>{summary}</div>
        </div>
      )}
      <CardActions
        article={article} isDismissed={false}
        summary={summary} isSummarizing={isSummarizing}
        isLiked={isLiked} isDisliked={isDisliked}
        onSummarize={onSummarize} onDismiss={onDismiss} onUndismiss={() => {}}
        onBlock={onBlock}
        onLike={onLike} onDislike={onDislike} onUnlike={onUnlike} onUndislike={onUndislike}
      />
    </div>
  );
}

// ── Digest tab ───────────────────────────────────────────────────────────────
function MobileDigestView({ digest, loading, dismissed, summaries, summarizing, expandedId,
                            likedIds, dislikedIds, onToggle, onSummarize, onDismiss, onBlock,
                            onLike, onDislike, onUnlike, onUndislike, onRegenerate }) {
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #1e2230", borderTopColor: MC.purple, display: "inline-block", animation: "spin 0.7s linear infinite" }} />
        <span style={{ fontSize: 12, color: MC.muted, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>asking Claude to pick the best stories…</span>
      </div>
    );
  }
  if (!digest) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, color: MC.muted, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>No digest yet.</span>
      </div>
    );
  }
  if (digest.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: MC.muted, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>Could not generate digest. Refresh feeds first.</span>
      </div>
    );
  }
  const visible = dismissed ? digest.filter(p => !dismissed.has(p.article.id)) : digest;
  return (
    <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Header banner */}
      <div style={{ margin: "12px 14px 4px", padding: "12px 14px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10 }}>
        <div style={{ fontSize: 9, color: MC.purple, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
          ▸ AI-curated · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        <div style={{ fontSize: 11, color: MC.muted, lineHeight: 1.6, marginBottom: 10, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
          Claude ranked these as the stories most likely to catch your attention.
        </div>
        <button onClick={onRegenerate}
          style={{ ...mBtn, width: "auto", padding: "8px 14px", color: MC.purple, borderColor: "rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.07)", fontSize: 11 }}>
          ↻ Regenerate
        </button>
      </div>
      {visible.map((pick, i) => (
        <MobileDigestCard
          key={pick.article.id}
          rank={i + 1}
          pick={pick}
          isExpanded={expandedId === pick.article.id}
          summary={summaries[pick.article.id]}
          isSummarizing={summarizing[pick.article.id]}
          isLiked={likedIds?.has(pick.article.id)}
          isDisliked={dislikedIds?.has(pick.article.id)}
          onToggle={() => onToggle(pick.article.id)}
          onSummarize={() => onSummarize(pick.article)}
          onDismiss={() => onDismiss(pick.article.id)}
          onBlock={() => onBlock(pick.article.link)}
          onLike={() => onLike(pick.article)}
          onDislike={() => onDislike(pick.article)}
          onUnlike={() => onUnlike(pick.article.id)}
          onUndislike={() => onUndislike(pick.article.id)}
        />
      ))}
    </div>
  );
}

// ── Sources management tab ───────────────────────────────────────────────────
function MobileSourcesView({ sources, srcStatus, onRemove, blocked, onUnblock,
                             showAdd, setShowAdd, newName, setNewName,
                             newUrl, setNewUrl, onAdd, onRefresh }) {
  const blockedList = blocked ? [...blocked].sort() : [];
  return (
    <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Source list */}
      {sources.map(src => (
        <div key={src.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 16px", borderBottom: `1px solid ${MC.border}`, background: MC.surf }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: src.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: MC.text, flex: 1, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>{src.name}</span>
          {srcStatus[src.id] === "error" && (
            <span style={{ fontSize: 10, color: MC.red, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>err</span>
          )}
          <button onClick={() => onRemove(src.id)}
            style={{ ...iconBtn, width: 36, height: 36, color: MC.muted, fontSize: 18, fontFamily: "inherit" }}>
            ×
          </button>
        </div>
      ))}

      {/* Actions */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {showAdd ? (
          <>
            <input className="nd-inp" style={mInput} placeholder="Source name" value={newName} onChange={e => setNewName(e.target.value)} />
            <input className="nd-inp" style={mInput} placeholder="RSS feed URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && onAdd()} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onAdd} style={{ ...mBtn, flex: 1, color: MC.accent, borderColor: "rgba(232,135,75,0.4)", background: "rgba(232,135,75,0.08)" }}>
                Add feed
              </button>
              <button onClick={() => { setShowAdd(false); setNewName(""); setNewUrl(""); }}
                style={{ ...mBtn, width: "auto", padding: "12px 16px", color: MC.muted }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setShowAdd(true)} style={{ ...mBtn, color: MC.accent, borderColor: "rgba(232,135,75,0.3)" }}>
              + Add RSS source
            </button>
            <button onClick={onRefresh} style={mBtn}>
              ↻ Refresh all feeds
            </button>
          </>
        )}
      </div>

      {/* Blocked domains */}
      {blockedList.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ fontSize: 9, color: MC.red, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
            ⊘ Blocked domains
          </div>
          {blockedList.map(domain => (
            <div key={domain} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: MC.surf, borderRadius: 8, marginBottom: 6, border: `1px solid ${MC.border}` }}>
              <span style={{ flex: 1, fontSize: 13, color: MC.text, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>{domain}</span>
              <button onClick={() => onUnblock(domain)}
                style={{ background: "none", border: "1px solid rgba(224,82,82,0.35)", color: MC.red, fontFamily: "'Noto Sans Nabataean', sans-serif", fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer" }}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bottom navigation icons ──────────────────────────────────────────────────
function FeedIcon({ active }) {
  const c = active ? MC.accent : MC.muted;
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <rect x="0" y="0"   width="18" height="2.5" rx="1.25" fill={c} />
      <rect x="0" y="5.5" width="18" height="2.5" rx="1.25" fill={c} opacity="0.65" />
      <rect x="0" y="11"  width="11" height="2.5" rx="1.25" fill={c} opacity="0.35" />
    </svg>
  );
}
function DigestIcon({ active }) {
  const c = active ? MC.accent : MC.muted;
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <polygon points="8,1 9.8,6.2 15.5,6.2 10.8,9.5 12.6,14.7 8,11.4 3.4,14.7 5.2,9.5 0.5,6.2 6.2,6.2" fill={c} />
    </svg>
  );
}
function SourcesIcon({ active }) {
  const c = active ? MC.accent : MC.muted;
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <circle cx="2" cy="2"  r="1.75" fill={c} />
      <rect x="5.5" y="0.6"  width="12.5" height="2.8" rx="1.4" fill={c} opacity="0.6" />
      <circle cx="2" cy="7"  r="1.75" fill={c} opacity="0.7" />
      <rect x="5.5" y="5.6"  width="12.5" height="2.8" rx="1.4" fill={c} opacity="0.42" />
      <circle cx="2" cy="12" r="1.75" fill={c} opacity="0.4" />
      <rect x="5.5" y="10.6" width="8"   height="2.8" rx="1.4" fill={c} opacity="0.25" />
    </svg>
  );
}

// ── Bottom tab bar ───────────────────────────────────────────────────────────
function MobileBottomNav({ tab, onTab }) {
  const tabs = [
    { id: "feed",    label: "Feed",    Icon: FeedIcon },
    { id: "digest",  label: "Digest",  Icon: DigestIcon },
    { id: "sources", label: "Sources", Icon: SourcesIcon },
  ];
  return (
    <nav style={{
      display: "flex", flexShrink: 0,
      background: MC.surf, borderTop: `1px solid ${MC.border}`,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {tabs.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => onTab(id)}
          style={{
            flex: 1, height: 56,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
            background: "transparent", border: "none", cursor: "pointer",
            color: tab === id ? MC.accent : MC.muted, transition: "color 0.15s",
          }}>
          <Icon active={tab === id} />
          <span style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ── Root mobile component ────────────────────────────────────────────────────
// Receives all state + handler props from the parent NewsDesk component.
export default function MobileApp({
  sources, articles, dismissed, blocked, srcStatus, fetching,
  activeSrc, setActiveSrc, showDismissed, setShowDismissed,
  summaries, summarizing, expandedId, setExpandedId,
  showAdd, setShowAdd, newName, setNewName, newUrl, setNewUrl,
  digest, digestLoading, prefs,
  onAddSource, onRemoveSource, onRefresh,
  onDismiss, onUndismiss, onBlock, onUnblock, onClearDismissed,
  onLike, onDislike, onUnlike, onUndislike,
  onSummarize, onRunDigest, countFor,
}) {
  const [tab, setTab] = useState("feed");

  const likedIds    = new Set(prefs.liked.map(a => a.id));
  const dislikedIds = new Set(prefs.disliked.map(a => a.id));

  const handleTab = (t) => {
    setTab(t);
    if (t === "digest" && !digest && !digestLoading) onRunDigest();
  };

  const visible = articles.filter(a => {
    if (showDismissed) return dismissed.has(a.id);
    if (dismissed.has(a.id)) return false;
    if (blocked && blocked.has(getDomain(a.link))) return false;
    if (activeSrc && a.sourceId !== activeSrc) return false;
    return true;
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh",
      background: MC.bg, color: MC.text, overflow: "hidden",
    }}>
      <MobileTopBar
        tab={tab}
        unreadCount={countFor(activeSrc)}
        fetching={fetching}
        onRefresh={onRefresh}
      />

      {/* ── Feed tab ── */}
      {tab === "feed" && (
        <>
          <MobileSourcePills
            sources={sources}
            activeSrc={activeSrc}
            showDismissed={showDismissed}
            countFor={countFor}
            onSelect={(id) => {
              if (id === "__dismissed") { setShowDismissed(true); setActiveSrc(null); }
              else { setActiveSrc(id); setShowDismissed(false); }
            }}
          />
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {showDismissed && dismissed.size > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px 2px" }}>
                <button onClick={onClearDismissed}
                  style={{ ...mBtn, width: "auto", padding: "7px 14px", fontSize: 12, color: MC.red, borderColor: "rgba(224,82,82,0.3)" }}>
                  Clear all
                </button>
              </div>
            )}
            {fetching && articles.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 160, gap: 8, color: MC.muted, fontSize: 12, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #1e2230", borderTopColor: MC.accent, display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                fetching feeds…
              </div>
            ) : visible.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 32px", color: MC.muted, fontSize: 12, fontFamily: "'Noto Sans Nabataean', sans-serif" }}>
                {showDismissed ? "Nothing dismissed yet." : "All caught up ✓"}
              </div>
            ) : (
              visible.map(article => (
                <MobileFeedCard
                  key={article.id}
                  article={article}
                  isDismissed={dismissed.has(article.id)}
                  isExpanded={expandedId === article.id}
                  summary={summaries[article.id]}
                  isSummarizing={summarizing[article.id]}
                  isLiked={likedIds.has(article.id)}
                  isDisliked={dislikedIds.has(article.id)}
                  onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
                  onSummarize={() => onSummarize(article)}
                  onDismiss={() => onDismiss(article.id)}
                  onUndismiss={() => onUndismiss(article.id)}
                  onBlock={() => onBlock(article.link)}
                  onLike={() => onLike(article)}
                  onDislike={() => onDislike(article)}
                  onUnlike={() => onUnlike(article.id)}
                  onUndislike={() => onUndislike(article.id)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* ── Digest tab ── */}
      {tab === "digest" && (
        <MobileDigestView
          digest={digest} loading={digestLoading} dismissed={dismissed}
          summaries={summaries} summarizing={summarizing}
          expandedId={expandedId} likedIds={likedIds} dislikedIds={dislikedIds}
          onToggle={id => setExpandedId(expandedId === id ? null : id)}
          onSummarize={onSummarize} onDismiss={onDismiss} onBlock={onBlock}
          onLike={onLike} onDislike={onDislike}
          onUnlike={onUnlike} onUndislike={onUndislike}
          onRegenerate={onRunDigest}
        />
      )}

      {/* ── Sources tab ── */}
      {tab === "sources" && (
        <MobileSourcesView
          sources={sources} srcStatus={srcStatus} onRemove={onRemoveSource}
          blocked={blocked} onUnblock={onUnblock}
          showAdd={showAdd} setShowAdd={setShowAdd}
          newName={newName} setNewName={setNewName}
          newUrl={newUrl}   setNewUrl={setNewUrl}
          onAdd={onAddSource} onRefresh={onRefresh}
        />
      )}

      <MobileBottomNav tab={tab} onTab={handleTab} />
    </div>
  );
}
