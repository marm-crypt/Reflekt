// components/EntryCard.jsx
import React, { useState } from "react";
import { analyzeMood } from "../lib/aiPromptEngine";

/* ---------------------------
   Helpers
---------------------------- */
function oneLine(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);

    const parts = d
      .toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      .split(" ");

    const weekday = parts[0]; // "Fri,"
    const month = parts[1];   // "Feb"
    const day = parts[2].replace(",", ""); // "6"
    const year = parts[3]; // "2026"

    return `${weekday} ${month} ${day}, ${year}`;
  } catch {
    return "";
  }
}

function toDateInputValue(iso) {
  const d = new Date(iso || "");
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mergeDateWithBaseTime(dateValue, baseIso) {
  if (!dateValue) return baseIso || new Date().toISOString();
  const base = new Date(baseIso || "");
  const safeBase = isNaN(base) ? new Date() : base;
  const [y, m, d] = dateValue.split("-").map(Number);
  const merged = new Date(safeBase);
  merged.setFullYear(y, m - 1, d);
  return merged.toISOString();
}

/* ---------------------------
   Mood logic (5 options)
   Great / Good / Okay / Bad / Awful
   (Used only when editing + saving)
---------------------------- */
function moodClass(mood) {
  if (mood === "Great") return "tag-mood-great";
  if (mood === "Good") return "tag-mood-good";
  if (mood === "Okay") return "tag-mood-ok";
  if (mood === "Bad") return "tag-mood-bad";
  return "tag-mood-awful";
}

function countWords(text) {
  return (text || "").trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function IconMood({ mood }) {
  const m = (mood || "Okay").toLowerCase();

  if (m === "great") {
    return (
      <svg className="tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l1.6 4.1L18 9l-4.4 1.9L12 15l-1.6-4.1L6 9l4.4-1.9L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (m === "good") {
    return (
      <svg className="tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 14c.7.8 1.8 1.2 3 1.2 1.2 0 2.3-.4 3-1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.2 10h.01M14.8 10h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (m === "bad") {
    return (
      <svg className="tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 15.4c.7-.8 1.8-1.2 3-1.2 1.2 0 2.3.4 3 1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.2 10h.01M14.8 10h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (m === "awful") {
    return (
      <svg className="tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.8 16c.8-.9 2-1.3 3.2-1.3s2.4.4 3.2 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 9.5l1.4 1.4M10.4 9.5L9 10.9M13.6 9.5l1.4 1.4M15 9.5l-1.4 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.2 10h.01M14.8 10h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------
   Icons
---------------------------- */
function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5l4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 3.5v3M17 3.5v3M3.5 9h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------
   EntryCard
---------------------------- */
export default function EntryCard({ entry, onUpdate, onDelete }) {
  const shownTime = entry?.created_at || entry?.updated_at || "";
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(entry?.title || "untitled");
  const [c, setC] = useState(entry?.content || "");
  const [entryDate, setEntryDate] = useState(() => toDateInputValue(shownTime));
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = React.useRef(null);

  async function save() {
    setMsg("");
    if (!c.trim()) {
      setMsg("Entry can’t be empty.");
      return;
    }
    if (typeof onUpdate !== "function") {
      setMsg("Update is not connected.");
      return;
    }

    setSaving(true);
    try {
      const content = c.trim();
      const title = (t || "").trim() || "untitled";
      const moodRes = analyzeMood(content);
      const mood = moodRes?.mood || "Okay";

      // Save mood as string, and include confidence/tokens for later display
      await onUpdate(entry.id, {
        title,
        content,
        created_at: mergeDateWithBaseTime(entryDate, shownTime),
        mood,
        mood_confidence: moodRes?.confidence ?? 0,
        mood_tokens: moodRes?.tokens ?? [],
        themes: [],
      });
      setEditing(false);
    } catch (e) {
      setMsg(e?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (typeof onDelete !== "function") return;
    if (!confirm("Delete this entry?")) return;
    await onDelete(entry.id);
  }

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMsg("Voice recording not supported in this browser. Try Chrome, Safari, or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let fullTranscript = "";

    recognition.onstart = () => {
      setIsRecording(true);
      setMsg("");
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          fullTranscript += transcript + " ";
        }
      }
    };

    recognition.onerror = (event) => {
      setMsg(`Recording error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (fullTranscript.trim()) {
        setC((prev) =>
          prev.trim() ? prev.trim() + " " + fullTranscript.trim() : fullTranscript.trim()
        );
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  // Normalize stored mood which may be a string, JSON string, or object.
  const rawMood = entry?.mood;
  let moodStr = "Okay";
  let confidence = entry?.mood_confidence;
  let moodTokens = entry?.mood_tokens || [];

  if (rawMood != null) {
    if (typeof rawMood === "object") {
      moodStr = rawMood.mood || moodStr;
      if (rawMood.confidence != null) confidence = rawMood.confidence;
      if (Array.isArray(rawMood.tokens)) moodTokens = rawMood.tokens;
    } else if (typeof rawMood === "string") {
      try {
        const parsed = JSON.parse(rawMood);
        if (parsed && typeof parsed === "object") {
          moodStr = parsed.mood || rawMood;
          if (parsed.confidence != null) confidence = parsed.confidence;
          if (Array.isArray(parsed.tokens)) moodTokens = parsed.tokens;
        } else {
          moodStr = rawMood;
        }
      } catch {
        moodStr = rawMood;
      }
    }
  }

  // Fallback for older entries that don't have mood persisted yet.
  if (rawMood == null || (typeof moodStr === "string" && !moodStr.trim())) {
    const computed = analyzeMood(entry?.content || "");
    moodStr = computed.mood;
    if (confidence == null) confidence = computed.confidence ?? 0;
    if (!moodTokens.length) moodTokens = computed.tokens ?? [];
  }

  function saveCorrection(newMood) {
    if (typeof onUpdate !== "function") return;
    setSaving(true);
    try {
      // optimistic: persist correction in localStorage for calibration
      try {
        const key = "mood-corrections";
        const raw = localStorage.getItem(key);
        const map = raw ? JSON.parse(raw) : {};
        map[entry.id] = { mood: newMood, when: Date.now() };
        localStorage.setItem(key, JSON.stringify(map));
      } catch (_) { }

      // send update to parent (stores on backend)
      onUpdate(entry.id, { mood: newMood, mood_confidence: 1, mood_tokens: [] });
      setOverrideOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entry-card">
      <div className="entry-main">
        {!editing ? (
          <>
            <h3 className="entry-title one-line">{entry?.title || "untitled"}</h3>
            <div className="entry-meta">{shownTime ? fmtTime(shownTime) : ""}</div>
            <div className="entry-preview one-line">{oneLine(entry?.content)}</div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6, opacity: 0.65 }}>
              {countWords(entry?.content)} words
            </div>
            <div className="tags" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
              {!overrideOpen ? (
                <span
                  className={`tag ${moodClass(moodStr)}`}
                  onClick={() => setOverrideOpen(true)}
                  style={{ cursor: "pointer" }}
                >
                  <IconMood mood={moodStr} />
                  Mood: {moodStr}
                </span>
              ) : (
                <div className="mood-override" onMouseLeave={() => setOverrideOpen(false)}>
                  {["Great", "Good", "Okay", "Bad", "Awful"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`tag ${moodClass(m)}`}
                      onClick={() => saveCorrection(m)}
                      style={{ marginRight: 8 }}
                    >
                      <IconMood mood={m} />
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Show extracted keywords if available */}
              {!overrideOpen && moodTokens && moodTokens.length > 0 && (
                <div style={{ display: "flex", gap: "4px", fontSize: "11px", opacity: 0.7 }}>
                  {moodTokens.map((tok, i) => (
                    <span key={i} style={{ background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: "12px" }}>
                      {tok}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="edit-form">
            <label className="small-muted">Title</label>
            <input value={t} onChange={(e) => setT(e.target.value)} />

            <label className="small-muted">Entry</label>
            <textarea value={c} onChange={(e) => setC(e.target.value)} rows={10} />

            <label className="small-muted">Date</label>
            <div className="edit-date-row">
              <IconCalendar />
              <input
                className="edit-date-input"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                max={toDateInputValue(new Date().toISOString())}
              />
            </div>

            <button
              type="button"
              onClick={toggleRecording}
              className={isRecording ? "recording-pulse" : ""}
              style={{
                marginTop: "8px",
                padding: "10px 12px",
                borderRadius: "6px",
                border: isRecording ? "2px solid #f45e5e" : "1px solid rgba(116, 94, 246, 0.2)",
                background: isRecording ? "rgba(244, 94, 94, 0.1)" : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 500,
                color: isRecording ? "#f45e5e" : "inherit",
                transition: "all 0.2s ease"
              }}
              title="Click to record voice entry"
            >
              <IconMic />
              {isRecording ? "Listening... (Click to Stop)" : "Record Voice"}
            </button>

            <div className="edit-actions">
              <button className="btn btn-primary" disabled={saving} onClick={save}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button className="btn btn-soft" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>

            {msg && <div className="small-muted">{msg}</div>}
          </div>
        )}
      </div>

      {!editing && (
        <div className="entry-actions">
          <button className="action-ic" onClick={() => setEditing(true)}>
            <IconEdit />
          </button>
          <button className="action-ic" onClick={remove}>
            <IconTrash />
          </button>
        </div>
      )}
    </div>
  );
}
