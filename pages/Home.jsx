// pages/Home.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import EntryCard from "../components/EntryCard";
import { ArrowsRightLeftIcon, MoonIcon, PlusIcon, SunIcon } from "@heroicons/react/24/outline";
import {
  analyzeMood, // Import the new function
  buildPromptContext,
  generateTitleSuggestionsLocal,
  generateTitleSuggestionsWithOllama,
  generatePromptsWithOllama,
  getContextualFallbackPrompts,
  getPromptCandidates,
  getTimeTheme,
  markPromptCompleted,
  markPromptShown,
  moodFromText,
  pickPersonalizedFromPool,
  pickPrompt,
  timeKey,
} from "../lib/aiPromptEngine";

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

function capFirst(str) {
  const s = (str || "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

function getTimeThemeOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = (params.get("timeofday") || "").toLowerCase().trim();
    if (v === "morning" || v === "afternoon" || v === "evening" || v === "night") {
      return v;
    }
  } catch {
    // no-op: safe fallback to live clock
  }
  return null;
}

function normalizePromptKey(promptText) {
  return (promptText || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clearLegacyAiPromptCaches(currentCacheKey) {
  if (typeof window === "undefined") return;
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith("reflekt_ai_prompts_")) continue;
      if (k === currentCacheKey) continue;
      toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

export default function Home({
  session = null, // ✅ safe default
  storageMode = "supabase",
  entries = [],
  entriesLoading,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onUpdateLocalName,
}) {
  const navigate = useNavigate();

  // ✅ auth guard (minimal, does not change any other behavior)
  useEffect(() => {
    if (!session) {
      navigate("/auth", { replace: true });
    }
  }, [session, navigate]);

  // Composer open by default (as locked)
  const [composerOpen, setComposerOpen] = useState(true);

  // Prompt + composer state
  const [prompt, setPrompt] = useState(() => pickPrompt("", entries));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [titleSuggesting, setTitleSuggesting] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = React.useRef(null);
  const draftHydratedRef = useRef(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [promptStats, setPromptStats] = useState({});
  const [aiPromptPool, setAiPromptPool] = useState([]);
  const [recentPromptHistory, setRecentPromptHistory] = useState([]);
  const [usedPromptKeys, setUsedPromptKeys] = useState([]);
  const [shownPromptKeys, setShownPromptKeys] = useState([]);
  const [aiSeenCounts, setAiSeenCounts] = useState({});
  const [aiPromptStatus, setAiPromptStatus] = useState("idle");
  const [aiLastError, setAiLastError] = useState("");
  const [localNameDraft, setLocalNameDraft] = useState("");
  const aiRequestRef = useRef(0);
  const aiPendingRef = useRef(null);
  const timeTheme = getTimeThemeOverride() || getTimeTheme();
  const showSun = timeTheme === "morning" || timeTheme === "afternoon";
  const showMoon = timeTheme === "evening" || timeTheme === "night";
  const draftStorageKey = useMemo(
    () => `reflekt_draft_${session?.user?.id || "anon"}`,
    [session?.user?.id]
  );
  const promptStatsKey = useMemo(
    () => `reflekt_prompt_stats_${session?.user?.id || "anon"}`,
    [session?.user?.id]
  );
  const usedPromptsKey = useMemo(
    () => `reflekt_used_prompts_${session?.user?.id || "anon"}`,
    [session?.user?.id]
  );
  const aiContextFingerprint = useMemo(() => {
    const recent = [...(Array.isArray(entries) ? entries : [])]
      .sort((a, b) => timeKey(b) - timeKey(a))
      .slice(0, 8);
    return recent
      .map((e) => `${e?.id || ""}:${e?.updated_at || e?.created_at || ""}`)
      .join("|");
  }, [entries]);
  const shownPromptsKey = useMemo(
    () => `reflekt_shown_prompts_${session?.user?.id || "anon"}_${aiContextFingerprint}`,
    [session?.user?.id, aiContextFingerprint]
  );
  const aiPromptCacheKey = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const promptFormatVersion = "v11";
    return `reflekt_ai_prompts_${promptFormatVersion}_${session?.user?.id || "anon"}_${today}_${aiContextFingerprint}`;
  }, [session?.user?.id, aiContextFingerprint]);
  const promptEngineResetKey = useMemo(
    () => `reflekt_prompt_engine_reset_v11_${session?.user?.id || "anon"}`,
    [session?.user?.id]
  );

  // ✅ compute first name (safe fallbacks)
  const firstName = useMemo(() => {
    const meta = session?.user?.user_metadata || {};
    const fn = capFirst(meta.first_name);
    if (fn) return fn;

    const full = (meta.full_name || "").trim();
    if (full) return capFirst(full.split(" ")[0]);

    return "";
  }, [session]);
  const needsLocalName =
    storageMode === "local" && (!firstName || firstName === "Local" || firstName === "Guest");

  useEffect(() => {
    if (!needsLocalName || localNameDraft) return;
    setLocalNameDraft(firstName === "Local" || firstName === "Guest" ? "" : firstName);
  }, [firstName, localNameDraft, needsLocalName]);

  function saveLocalDisplayName(e) {
    e.preventDefault();
    const cleanName = capFirst(localNameDraft);
    if (!cleanName || typeof onUpdateLocalName !== "function") return;
    onUpdateLocalName(cleanName);
  }

  // First-time helper only for the user's first entry
  const showFirstTimeHelper = useMemo(() => {
    const flag = localStorage.getItem("reflekt_first_entry_done");
    return !flag && (entries?.length || 0) === 0;
  }, [entries]);

  const sortedEntries = useMemo(() => {
    const arr = Array.isArray(entries) ? [...entries] : [];
    arr.sort((a, b) => timeKey(b) - timeKey(a));
    return arr;
  }, [entries]);
  const [visibleCount, setVisibleCount] = useState(3);
  const visibleEntries = useMemo(
    () => sortedEntries.slice(0, visibleCount),
    [sortedEntries, visibleCount]
  );
  const hasMorePastEntries = visibleCount < sortedEntries.length;

  useEffect(() => {
    setVisibleCount(3);
  }, [sortedEntries.length]);

  // ✅ If entries arrive later from Supabase, update prompt once (only if composer is open)
  const [promptHydrated, setPromptHydrated] = useState(false);
  useEffect(() => {
    if (!promptHydrated && composerOpen && Array.isArray(entries) && entries.length > 0) {
      const usedSet = new Set(usedPromptKeys);
      const nextFromAi = pickPersonalizedFromPool(
        aiPromptPool.filter((x) => !usedSet.has(normalizePromptKey(x))),
        prompt,
        promptStats
      );
      const nextFromFallback = pickPersonalizedFromPool(
        getPromptCandidates(entries).filter((x) => !usedSet.has(normalizePromptKey(x))),
        prompt,
        promptStats
      );
      setPrompt(nextFromAi || nextFromFallback || pickPrompt(prompt, entries, promptStats));
      setPromptHydrated(true);
    }
  }, [entries, composerOpen, promptHydrated, promptStats, aiPromptPool, prompt, usedPromptKeys]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(promptStatsKey);
      if (!raw) {
        setPromptStats({});
        return;
      }
      const parsed = JSON.parse(raw);
      setPromptStats(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setPromptStats({});
    }
  }, [promptStatsKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(usedPromptsKey);
      if (!raw) {
        setUsedPromptKeys([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setUsedPromptKeys(Array.isArray(parsed) ? parsed : []);
    } catch {
      setUsedPromptKeys([]);
    }
  }, [usedPromptsKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(shownPromptsKey);
      if (!raw) {
        setShownPromptKeys([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setShownPromptKeys(Array.isArray(parsed) ? parsed : []);
    } catch {
      setShownPromptKeys([]);
    }
  }, [shownPromptsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(promptStatsKey, JSON.stringify(promptStats || {}));
    } catch {
      // ignore storage errors
    }
  }, [promptStats, promptStatsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(usedPromptsKey, JSON.stringify(usedPromptKeys || []));
    } catch {
      // ignore storage errors
    }
  }, [usedPromptKeys, usedPromptsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(shownPromptsKey, JSON.stringify(shownPromptKeys || []));
    } catch {
      // ignore storage errors
    }
  }, [shownPromptKeys, shownPromptsKey]);

  useEffect(() => {
    if (!prompt) return;
    const shownKey = normalizePromptKey(prompt);
    if (shownKey) {
      setShownPromptKeys((prev) => (prev.includes(shownKey) ? prev : [...prev, shownKey]));
    }
    setPromptStats((prev) => markPromptShown(prev, prompt));
    setRecentPromptHistory((prev) => {
      const next = [...prev, prompt];
      return next.slice(-24);
    });
    setAiSeenCounts((prev) => ({
      ...prev,
      [prompt]: (prev[prompt] || 0) + 1,
    }));
  }, [prompt]);

  async function ensureAiPrompts({ force = false } = {}) {
    if (!force && aiPromptPool.length >= 16) return aiPromptPool;
    if (aiPromptStatus === "loading") {
      return aiPendingRef.current || aiPromptPool;
    }

    const requestId = aiRequestRef.current + 1;
    aiRequestRef.current = requestId;
    setAiPromptStatus("loading");
    setAiLastError("");

    const pending = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const context = buildPromptContext(entries);
        const generated = await generatePromptsWithOllama(context, controller.signal);
        if (aiRequestRef.current !== requestId) return aiPromptPool;

        if (generated.length) {
          const merged = [...new Set([...(generated || []), ...aiPromptPool])].slice(0, 40);
          setAiPromptPool(merged);
          setAiPromptStatus("ready");
          try {
            localStorage.setItem(
              aiPromptCacheKey,
              JSON.stringify({ prompts: merged, savedAt: Date.now() })
            );
          } catch {
            // ignore storage errors
          }
          return merged;
        }
        setAiPromptStatus("idle");
      } catch (err) {
        const message = controller.signal.aborted
          ? "Request timed out waiting for Ollama"
          : err?.message || "Could not generate prompts from Ollama";
        setAiLastError(message);
        if (aiRequestRef.current === requestId) {
          setAiPromptStatus("idle");
        }
      } finally {
        clearTimeout(timeoutId);
        aiPendingRef.current = null;
      }
      return aiPromptPool;
    })();

    aiPendingRef.current = pending;
    return pending;
  }

  useEffect(() => {
    draftHydratedRef.current = false;
  }, [draftStorageKey]);

  useEffect(() => {
    if (!composerOpen || draftHydratedRef.current) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) {
        draftHydratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setTitle((parsed.title || "").toString());
        setContent((parsed.content || "").toString());
        if (parsed.prompt) setPrompt((parsed.prompt || "").toString());
        if (parsed.savedAt) setDraftSavedAt(parsed.savedAt);
      }
    } catch {
      // Ignore malformed drafts
    } finally {
      draftHydratedRef.current = true;
    }
  }, [composerOpen, draftStorageKey]);

  useEffect(() => {
    if (!composerOpen || !draftHydratedRef.current) return;

    const hasDraftContent = title.trim().length > 0 || content.trim().length > 0;
    if (!hasDraftContent) {
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore storage errors
      }
      setDraftSavedAt(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        const payload = {
          title,
          content,
          prompt,
          savedAt: Date.now(),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setDraftSavedAt(payload.savedAt);
      } catch {
        // ignore storage errors
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [title, content, prompt, composerOpen, draftStorageKey]);

  useEffect(() => {
    clearLegacyAiPromptCaches(aiPromptCacheKey);
  }, [aiPromptCacheKey]);

  useEffect(() => {
    try {
      if (localStorage.getItem(promptEngineResetKey)) return;
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("reflekt_ai_prompts_")) {
          localStorage.removeItem(k);
        }
      }
      localStorage.removeItem(promptStatsKey);
      localStorage.removeItem(usedPromptsKey);
      localStorage.removeItem(shownPromptsKey);
      localStorage.setItem(promptEngineResetKey, "1");
      setAiPromptPool([]);
      setPromptStats({});
      setUsedPromptKeys([]);
      setShownPromptKeys([]);
    } catch {
      // ignore storage errors
    }
  }, [promptEngineResetKey, promptStatsKey, usedPromptsKey, shownPromptsKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(aiPromptCacheKey);
      if (!raw) {
        setAiPromptPool([]);
        setAiPromptStatus("idle");
        return;
      }
      const parsed = JSON.parse(raw);
      const cachedPrompts = Array.isArray(parsed?.prompts) ? parsed.prompts : [];
      setAiPromptPool(cachedPrompts);
      setAiPromptStatus(cachedPrompts.length ? "ready" : "idle");
    } catch {
      setAiPromptPool([]);
      setAiPromptStatus("idle");
    }
  }, [aiPromptCacheKey]);

  useEffect(() => {
    if (!composerOpen) return;
    if (aiPromptPool.length >= 20) return;
    ensureAiPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen, entries, aiPromptPool.length]);

  useEffect(() => {
    if (!composerOpen) return;
    if (!prompt || !aiPromptPool.length) return;
    if (title.trim() || content.trim()) return;
    if (aiPromptPool.includes(prompt)) return;
    setPrompt((prev) => pickPersonalizedFromPool(aiPromptPool, prev, promptStats) || prev);
  }, [aiPromptPool, composerOpen, prompt, title, content, promptStats]);

  function shufflePrompt() {
    const blocked = new Set(recentPromptHistory.slice(-18));
    blocked.add(prompt);
    const usedSet = new Set(usedPromptKeys);
    const shownSet = new Set(shownPromptKeys);
    setMsg("");

    // Keep shuffle instant: never block button click on network/model generation.
    const pool = aiPromptPool;
    const pickFromPool = (candidatePool, { allowShown = false, allowUsed = false } = {}) => {
      const candidates = (candidatePool || []).filter((x) => {
        const key = normalizePromptKey(x);
        if (blocked.has(x)) return false;
        if (!allowUsed && usedSet.has(key)) return false;
        if (!allowShown && shownSet.has(key)) return false;
        return true;
      });
      if (!candidates.length) return "";
      const minSeen = candidates.reduce((min, item) => {
        const seen = aiSeenCounts[item] || 0;
        return seen < min ? seen : min;
      }, Number.POSITIVE_INFINITY);
      const leastSeen = candidates.filter((item) => (aiSeenCounts[item] || 0) === minSeen);
      return pickPersonalizedFromPool(leastSeen, prompt, promptStats);
    };

    // 1) Best case: unseen + unused.
    const fromAiNow = pickFromPool(pool, { allowShown: false, allowUsed: false });
    if (fromAiNow) {
      setPrompt(fromAiNow);
      return;
    }

    const fallbackPool = [
      ...getContextualFallbackPrompts(entries),
      ...getPromptCandidates(entries),
    ].filter((x) => {
      const key = normalizePromptKey(x);
      return !blocked.has(x) && !usedSet.has(key) && !shownSet.has(key);
    });
    const fallback = pickPersonalizedFromPool(fallbackPool, prompt, promptStats);
    if (fallback) {
      setPrompt(fallback);
      return;
    }

    // 2) If unseen exhausted, reuse shown but still avoid recent/current.
    const fromAiShown = pickFromPool(pool, { allowShown: true, allowUsed: false });
    if (fromAiShown) {
      setPrompt(fromAiShown);
      return;
    }

    // 3) Last resort: allow any non-recent alternative.
    const fromAiAny = pickFromPool(pool, { allowShown: true, allowUsed: true });
    if (fromAiAny) {
      setPrompt(fromAiAny);
      return;
    }

    if (pool.length <= 14 && aiPromptStatus !== "loading") {
      ensureAiPrompts({ force: true })
        .then((refreshed) => {
          if (!Array.isArray(refreshed) || !refreshed.length) return;
          const fromFresh =
            pickFromPool(refreshed, { allowShown: false, allowUsed: false }) ||
            pickFromPool(refreshed, { allowShown: true, allowUsed: false }) ||
            pickFromPool(refreshed, { allowShown: true, allowUsed: true });
          if (fromFresh) {
            setPrompt(fromFresh);
            setMsg("");
          }
        })
        .catch(() => { });
      setMsg("Generating fresh prompts...");
      return;
    }

    setMsg("You’ve seen all prompts for this current context. Add or edit an entry to unlock new ones.");
  }

  function startNewEntry() {
    setComposerOpen(true);
    setTitle("");
    setTitleSuggestions([]);
    setContent("");
    const usedSet = new Set(usedPromptKeys);
    const nextFromAi = pickPersonalizedFromPool(
      aiPromptPool.filter((x) => !usedSet.has(normalizePromptKey(x))),
      prompt,
      promptStats
    );
    const nextFromFallback = pickPersonalizedFromPool(
      getPromptCandidates(entries).filter((x) => !usedSet.has(normalizePromptKey(x))),
      prompt,
      promptStats
    );
    setPrompt(nextFromAi || nextFromFallback || pickPrompt(prompt, entries, promptStats));
    setMsg("");
    setDraftSavedAt(null);
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore storage errors
    }
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

    const baseContent = (content || "").trim();
    let committedTranscript = "";

    recognition.onstart = () => {
      setIsRecording(true);
      setMsg("");
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          committedTranscript += transcript + " ";
        }
      }

      const interimTranscript = Array.from(event.results)
        .filter((r) => !r.isFinal)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();

      const liveText = [baseContent, committedTranscript.trim(), interimTranscript]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      setContent(liveText);
    };

    recognition.onerror = (event) => {
      setMsg(`Recording error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function save(e) {
    e.preventDefault();
    setMsg("");

    if (!content.trim()) {
      setMsg("Please write something first.");
      return;
    }

    if (typeof onAddEntry !== "function") {
      setMsg("Save is not connected (onAddEntry missing).");
      return;
    }

    setSaving(true);
    try {
      const cleanContent = content.trim();
      const rawTitle = (title || "").trim();
      const needsAutoTitle = !rawTitle || rawTitle.toLowerCase() === "untitled";
      const autoTitle = needsAutoTitle
        ? (generateTitleSuggestionsLocal({ content: cleanContent, currentTitle: rawTitle })[0] || "")
        : "";
      const cleanTitle = rawTitle || autoTitle || "untitled";

      const moodRes = analyzeMood(cleanContent);
      // Mood handled by onAddEntry (App/Supabase layer) but we pass explicit checks if we want
      // Actually APP_SPECS says mood handled by onAddEntry... wait, checking Home.jsx original code.
      // Original code: mood: moodFromText(cleanContent) (which returned string)
      // We should pass the object now if the backend supports it, or just the string if not.
      // App.jsx likely just writes what we give it to Supabase.
      // Let's pass the same structure as EntryCard to be safe/consistent.

      await onAddEntry({
        title: cleanTitle,
        content: cleanContent,
        mood: moodRes.mood,
        mood_confidence: moodRes.confidence,
        mood_tokens: moodRes.tokens,
        themes: [],
      });

      setPromptStats((prev) => markPromptCompleted(prev, prompt, cleanContent));
      const usedKey = normalizePromptKey(prompt);
      if (usedKey) {
        setUsedPromptKeys((prev) => (prev.includes(usedKey) ? prev : [...prev, usedKey]));
      }

      localStorage.setItem("reflekt_first_entry_done", "1");
      localStorage.removeItem(draftStorageKey);
      setComposerOpen(false);
      setTitle("");
      setTitleSuggestions([]);
      setContent("");
      setDraftSavedAt(null);
      setMsg("");
    } catch (err) {
      setMsg(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (content.trim()) return;
    setTitleSuggestions([]);
  }, [content]);

  async function suggestTitles() {
    const cleanContent = (content || "").trim();
    if (!cleanContent) {
      setMsg("Write a bit first, then I can suggest titles.");
      return;
    }
    if (cleanContent.split(/\s+/).filter(Boolean).length < 12) {
      setMsg("Write a little more so title suggestions can be specific.");
      return;
    }

    setTitleSuggesting(true);
    setMsg("");
    let timeoutId = null;
    try {
      const localSuggestions = generateTitleSuggestionsLocal({
        content: cleanContent,
        currentTitle: title,
      });
      if (localSuggestions.length) {
        setTitleSuggestions(localSuggestions.slice(0, 5));
      }

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 4000);
      const suggestions = await generateTitleSuggestionsWithOllama({
        content: cleanContent,
        currentTitle: title,
        signal: controller.signal,
      });

      if (Array.isArray(suggestions) && suggestions.length) {
        setTitleSuggestions(suggestions.slice(0, 5));
      } else if (!localSuggestions.length) {
        setTitleSuggestions([]);
        setMsg("Couldn't generate title suggestions right now.");
      }
    } catch {
      const localSuggestions = generateTitleSuggestionsLocal({
        content: cleanContent,
        currentTitle: title,
      });
      if (localSuggestions.length) {
        setTitleSuggestions(localSuggestions.slice(0, 5));
      } else {
        setTitleSuggestions([]);
        setMsg("Couldn't generate title suggestions right now.");
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setTitleSuggesting(false);
    }
  }

  return (
    <div className="stack">
      {/* Greeting header with time-of-day gradient + badge */}
      <div className={`time-header time-header--${timeTheme}`}>
        <div className="time-header-title">
          {showSun ? (
            <SunIcon className="time-header-icon time-header-icon--sun" width={26} height={26} strokeWidth={2.3} />
          ) : showMoon ? (
            <MoonIcon className="time-header-icon time-header-icon--moon" width={24} height={24} strokeWidth={2.3} />
          ) : null}
          {timeGreeting()}
          {firstName ? `, ${firstName}` : ""}
        </div>
      </div>

      {needsLocalName && (
        <form className="local-name-banner" onSubmit={saveLocalDisplayName}>
          <div>
            <div className="local-name-title">Personalize this demo</div>
            <div className="small-muted">Add a name for the greeting on this device.</div>
          </div>
          <div className="local-name-controls">
            <input
              value={localNameDraft}
              onChange={(e) => setLocalNameDraft(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
            />
            <button
              type="submit"
              className="btn btn-soft"
              disabled={!localNameDraft.trim()}
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Composer */}
      {composerOpen ? (
        <div className="card">
          <div className="card-inner">
            <div className={`prompt-band prompt-band--${timeTheme}`}>
              <div className="prompt-head">
                <div className="prompt-label">Prompt</div>
                <button
                  type="button"
                  className="prompt-shuffle-btn"
                  onClick={shufflePrompt}
                  title="Shuffle prompt"
                  aria-label="Shuffle prompt"
                >
                  <ArrowsRightLeftIcon
                    width={16}
                    height={16}
                    strokeWidth={2.2}
                    style={{ color: "currentColor" }}
                  />
                </button>
              </div>
              <div className="prompt-text">{prompt}</div>
            </div>
            {showFirstTimeHelper && (
              <div className="small-muted">
                Tip: After you save, Reflekt adds a gentle mood read to help you reflect later.
              </div>
            )}

            <form onSubmit={save} className="stack" style={{ gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                <label className="small-muted" style={{ fontWeight: 600 }}>
                  Entry
                </label>
                <button
                  className={`record-btn ${isRecording ? "recording-pulse" : ""}`}
                  type="button"
                  onClick={toggleRecording}
                  style={{
                    padding: "8px 10px",
                    minWidth: "126px",
                    borderRadius: "8px",
                    border: isRecording ? "2px solid #f45e5e" : "1px solid rgba(116, 94, 246, 0.2)",
                    background: isRecording ? "rgba(244, 94, 94, 0.18)" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: isRecording ? 700 : 600,
                    color: isRecording ? "#f45e5e" : "inherit",
                    transition: "all 0.2s ease"
                  }}
                  title="Click to record voice entry"
                >
                  <span className="record-mic-wrap">
                    <IconMic />
                  </span>
                  {isRecording ? "Stop Recording" : "Record Voice"}
                </button>
              </div>
              <textarea
                className={`entry-textarea ${isRecording ? "is-recording" : ""}`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What’s on your mind?"
                rows={10}
              />
              {isRecording ? (
                <div className="recording-hint" role="status" aria-live="polite">
                  <span className="recording-hint-dot" aria-hidden="true" />
                  Recording in progress...
                </div>
              ) : null}
              <label className="small-muted" style={{ fontWeight: 600 }}>
                Title (optional)
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -6, marginBottom: 2 }}>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={suggestTitles}
                  disabled={titleSuggesting || saving}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                >
                  {titleSuggesting ? "Suggesting..." : "Suggest titles"}
                </button>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a short title if you want"
              />
              {titleSuggestions.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                  {titleSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="btn btn-soft"
                      onClick={() => setTitle(s)}
                      style={{ padding: "6px 10px", fontSize: 12 }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {/* Contract: NO tags shown while typing */}

              <button
                className={`save-btn ${content.trim().length ? "is-active" : ""}`}
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save entry"}
              </button>

              {(title.trim() || content.trim()) && !saving && (
                <div className="small-muted" style={{ marginTop: -4 }}>
                  {draftSavedAt
                    ? `Draft autosaved at ${new Date(draftSavedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                    : "Saving draft..."}
                </div>
              )}

              {msg && <div className="small-muted">{msg}</div>}
            </form>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-block new-entry-btn" onClick={startNewEntry}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <PlusIcon width={16} height={16} strokeWidth={2.4} />
            New Entry
          </span>
        </button>
      )}

      {/* Latest entries */}
      <div className="card">
        <div className="card-inner">
          <div className="section-title">
            <span className="accent-dot" />
            Latest entries
          </div>

          {entriesLoading ? (
            <div className="small-muted">Loading…</div>
          ) : visibleEntries.length === 0 ? (
            <div className="small-muted">No entries yet.</div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {visibleEntries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  onUpdate={onUpdateEntry}
                  onDelete={onDeleteEntry}
                />
              ))}
              {hasMorePastEntries && (
                <button
                  type="button"
                  className="btn btn-soft load-past-btn"
                  onClick={() => setVisibleCount((v) => v + 5)}
                >
                  Load past entries
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
