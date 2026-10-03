// lib/aiPromptEngine.js
// Reflekt — Controlled-Language Prompt Engine (bulletproof)
// Design goals:
// - Prompts feel personal but never weird/ungrammatical
// - No raw phrase injection from entries (no "things went smoothly work")
// - Unlimited non-repeated prompts via: large template library + safe AI expansion (optional)
// - Keeps your existing exports + expected signatures so Home.jsx doesn’t break

import Sentiment from "sentiment";

/* =========================================================
   0) Template library (curated, controlled language)
   - IMPORTANT RULE: templates must NOT hedge domains like "work or school"
   - If domain is uncertain, use neutral wording like "responsibilities"
   ========================================================= */

const TEMPLATE_LIBRARY = [
  // --- General reflection ---
  { id: "gen_001", domains: ["general"], actions: ["reflect"], tones: ["gentle", "neutral"], text: "How did the day feel to you really?" },
  { id: "gen_002", domains: ["general"], actions: ["reflect"], tones: ["gentle", "neutral"], text: "Anything stick with you from {timeframe}?" },
  { id: "gen_003", domains: ["general"], actions: ["reframe"], tones: ["gentle"], text: "If you could be a little kinder to yourself right now, what would you say?" },
  { id: "gen_004", domains: ["general"], actions: ["plan"], tones: ["neutral", "direct"], text: "What’s one small thing that would make {timeframe_next} feel easier?" },
  { id: "gen_005", domains: ["general"], actions: ["gratitude"], tones: ["upbeat", "gentle"], text: "Was there a small win {timeframe} that you might be overlooking?" },
  { id: "gen_006", domains: ["general"], actions: ["release"], tones: ["gentle"], text: "Is there anything you want to put down before you rest?" },
  { id: "gen_007", domains: ["general"], actions: ["values"], tones: ["gentle", "neutral"], text: "What really matters to you right now?" },
  { id: "gen_008", domains: ["general"], actions: ["support"], tones: ["gentle"], text: "What do you actually need most right now?" },

  // --- Responsibilities (neutral fallback) ---
  { id: "resp_001", domains: ["responsibilities"], actions: ["plan"], tones: ["neutral", "direct"], text: "Is there a task you can simplify for {timeframe_next}?" },
  { id: "resp_002", domains: ["responsibilities"], actions: ["boundaries"], tones: ["gentle", "neutral"], text: "Where can you draw a line to protect your energy?" },
  { id: "resp_003", domains: ["responsibilities"], actions: ["reflect"], tones: ["neutral"], text: "How are you handling everything on your plate?" },
  { id: "resp_004", domains: ["responsibilities"], actions: ["reframe"], tones: ["gentle"], text: "What would “good enough” look like for {timeframe_next}?" },

  // --- Work ---
  { id: "work_001", domains: ["work"], actions: ["plan"], tones: ["neutral", "direct"], text: "What’s the one work thing that actually needs your focus {timeframe_next}?" },
  { id: "work_002", domains: ["work"], actions: ["boundaries"], tones: ["gentle", "neutral"], text: "Can you protect some headspace from work this week?" },
  { id: "work_003", domains: ["work"], actions: ["reflect"], tones: ["neutral"], text: "How is work sitting with you right now?" },
  { id: "work_004", domains: ["work"], actions: ["reframe"], tones: ["gentle"], text: "Is there a way to make work feel a little lighter {timeframe_next}?" },

  // --- School ---
  { id: "school_001", domains: ["school"], actions: ["plan"], tones: ["neutral", "direct"], text: "What’s the main thing to tackle for school {timeframe_next}?" },
  { id: "school_002", domains: ["school"], actions: ["boundaries"], tones: ["gentle", "neutral"], text: "Are you giving yourself enough breaks from studying?" },
  { id: "school_003", domains: ["school"], actions: ["reflect"], tones: ["neutral"], text: "How are you feeling about your classes lately?" },

  // --- Relationships ---
  { id: "rel_001", domains: ["relationships"], actions: ["reflect"], tones: ["gentle", "neutral"], text: "How are you feeling about your connections with people?" },
  { id: "rel_002", domains: ["relationships"], actions: ["plan"], tones: ["gentle"], text: "Is there someone you’d like to feel closer to?" },
  { id: "rel_003", domains: ["relationships"], actions: ["boundaries"], tones: ["gentle", "neutral"], text: "Do you need a bit more space from anyone right now?" },
  { id: "rel_004", domains: ["relationships"], actions: ["support"], tones: ["gentle"], text: "Who feels like a safe harbor for you these days?" },

  // --- Health / Energy ---
  { id: "hlth_001", domains: ["health"], actions: ["reflect"], tones: ["gentle", "neutral"], text: "How is your body feeling right now?" },
  { id: "hlth_002", domains: ["health"], actions: ["plan"], tones: ["gentle", "neutral"], text: "What would be the kindest thing for your body {timeframe_next}?" },
  { id: "hlth_003", domains: ["health"], actions: ["rest"], tones: ["gentle"], text: "Are you letting yourself rest properly?" },
  { id: "hlth_004", domains: ["health"], actions: ["gratitude"], tones: ["upbeat", "gentle"], text: "Anything your body did for you today that you appreciate?" },

  // --- Money / Life Admin ---
  { id: "money_001", domains: ["money"], actions: ["plan"], tones: ["neutral", "direct"], text: "Is there a money worry you can pause or address?" },
  { id: "admin_001", domains: ["life_admin"], actions: ["plan"], tones: ["neutral", "direct"], text: "What’s one life admin thing you could knock out quickly?" },

  // --- Self / Inner Critic ---
  { id: "self_001", domains: ["self"], actions: ["reframe"], tones: ["gentle"], text: "If a friend spoke to you the way you speak to yourself, what would you say?" },
  { id: "self_002", domains: ["self"], actions: ["reflect"], tones: ["gentle", "neutral"], text: "Where did you show up for yourself {timeframe}?" },
  { id: "self_003", domains: ["self"], actions: ["values"], tones: ["gentle"], text: "Who do you want to be {timeframe_next}?" },

  // --- Stress / Overwhelm ---
  { id: "stress_001", domains: ["stress"], actions: ["rest"], tones: ["gentle"], text: "Can you unclench your jaw and take a breath right now?" },
  { id: "stress_002", domains: ["stress"], actions: ["plan"], tones: ["gentle", "neutral"], text: "What’s the very first tiny step to clearing the fog?" },
  { id: "stress_003", domains: ["stress"], actions: ["support"], tones: ["gentle"], text: "You don't have to do it all alone. Who can help?" },

  // --- Weekend / Rhythm ---
  { id: "wknd_001", domains: ["general"], actions: ["release"], tones: ["gentle"], text: "Ready to leave the week behind?" },
  { id: "wknd_002", domains: ["general"], actions: ["plan"], tones: ["gentle", "neutral"], text: "What does a perfect restorative weekend look like to you?" },
  { id: "wknd_003", domains: ["general"], actions: ["values"], tones: ["gentle"], text: "What are you making space for this weekend?" },
];

/* =========================================================
   1) Lightweight mood + time utilities (kept compatible)
   ========================================================= */

function getTimeBucket(date = new Date()) {
  const h = date.getHours();
  return h >= 5 && h < 15 ? "morning" : "night";
}

export function getTimeTheme(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function timeKey(entry) {
  const a = entry?.created_at ? Date.parse(entry.created_at) : NaN;
  if (!Number.isNaN(a)) return a;
  const b = entry?.updated_at ? Date.parse(entry.updated_at) : NaN;
  if (!Number.isNaN(b)) return b;
  return 0;
}

export function analyzeMood(text) {
  try {
    const analyzer = new Sentiment();
    const res = analyzer.analyze(text || "");
    const score = typeof res.score === "number" ? res.score : 0;

    // derive a simple confidence metric from the magnitude of the score
    // normalize: confidence = clamp(|score| / 6, 0, 1)
    const confidence = Math.min(1, Math.abs(score) / 6);

    // pick top contributing terms (positive and negative) to show as a hint
    const tokens = (res.words || []).slice(0, 6);

    let mood = "Okay";
    if (score >= 5) mood = "Great";
    else if (score >= 2) mood = "Good";
    else if (score >= -1) mood = "Okay";
    else if (score >= -4) mood = "Bad";
    else mood = "Awful";

    return { mood, score, confidence, tokens };
  } catch {
    return { mood: "Okay", score: 0, confidence: 0, tokens: [] };
  }
}

export function moodFromText(text) {
  return analyzeMood(text).mood;
}

function normalizePromptMood(rawMood) {
  const raw = (rawMood || "").toString().toLowerCase().trim();
  if (!raw) return null;
  if (raw === "anxious" || raw === "reflective" || raw === "grateful" || raw === "stuck") return raw;
  if (raw === "great") return "grateful";
  if (raw === "good" || raw === "okay") return "reflective";
  if (raw === "bad") return "stuck";
  if (raw === "awful") return "anxious";
  return null;
}

function inferMoodFromText(text) {
  const mood = moodFromText(text);
  return normalizePromptMood(mood);
}

/* =========================================================
   2) Snapshot building: domains/states/actions/tone + modes
   - NO raw phrase injection
   - Domain activation requires multi-signal (not 1 word)
   - Weekend/week/month signals are used to *gate*, not to get corny
   ========================================================= */

// Domain keywords are split into:
// - "strong": domain-specific, low ambiguity tokens
// - "weak": more ambiguous tokens, only count if paired with strong
const DOMAIN_KEYWORDS = {
  work: {
    strong: ["deadline", "meeting", "coworker", "manager", "office", "client", "project"],
    weak: ["work", "job"],
  },
  school: {
    strong: ["exam", "assignment", "homework", "teacher", "professor", "course"],
    weak: ["school", "class", "study"],
  },
  relationships: {
    strong: ["partner", "relationship", "roommate", "boyfriend", "girlfriend"],
    weak: ["friend", "friends", "family", "parent", "sister", "brother"],
  },
  health: {
    strong: ["therapy", "doctor", "migraine", "headache", "sick", "injury"],
    weak: ["sleep", "rest", "tired", "energy", "health", "exercise", "food"],
  },
  money: {
    strong: ["rent", "debt", "income", "paycheck", "mortgage"],
    weak: ["money", "budget", "bill", "expense", "pay"],
  },
  life_admin: {
    strong: ["paperwork", "appointment", "bank", "insurance"],
    weak: ["laundry", "clean", "groceries", "errand", "email"],
  },
  self: {
    strong: ["self-esteem", "confidence", "shame", "comparison", "worthy"],
    weak: ["self", "critic", "proud"],
  },
};

const ACTION_KEYWORDS = {
  plan: ["plan", "schedule", "tomorrow", "next", "decide", "choice", "priority"],
  boundaries: ["boundary", "boundaries", "limit", "protect", "space"],
  rest: ["rest", "sleep", "pause", "break", "recover"],
  support: ["support", "help", "talk", "reach", "ask", "someone"],
  gratitude: ["grateful", "gratitude", "appreciate", "thankful"],
  reflect: ["reflect", "notice", "realize", "learn", "pattern"],
  reframe: ["reframe", "perspective", "story", "assume", "thought"],
  values: ["value", "values", "aligned", "meaning", "purpose"],
  release: ["let go", "release", "leave behind"],
};

const STATE_HINTS = {
  overwhelmed: ["overwhelmed", "too much", "stressed", "stress", "pressure", "burnout"],
  low_energy: ["tired", "exhausted", "drained", "low energy"],
  anxious: ["anxious", "anxiety", "nervous", "worry", "worried"],
  lonely: ["lonely", "alone", "isolated"],
  calm: ["calm", "steady", "peaceful"],
  hopeful: ["hopeful", "excited", "optimistic"],
};

// “Sensitive mode” keywords: keep prompts supportive/grounded, avoid probing
// (We’re not outputting anything graphic; this is just for safer prompt selection.)
const SENSITIVE_HINTS = [
  "abuse",
  "assault",
  "trauma",
  "ptsd",
  "self-harm",
  "suicide",
  "suicidal",
  "overdose",
  "violence",
];

function tokenize(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function tokenString(tokens) {
  return (tokens || []).join(" ");
}

function countKeywordHits(tokens, keywords) {
  if (!Array.isArray(tokens) || tokens.length === 0) return 0;
  const joined = tokenString(tokens);
  let n = 0;
  for (const k of keywords) {
    const kw = (k || "").toString().toLowerCase().trim();
    if (!kw) continue;
    if (kw.includes(" ")) {
      if (joined.includes(kw)) n += 1;
    } else {
      if (tokens.includes(kw)) n += 1;
    }
  }
  return n;
}

function pickTopKeys(scoreMap, max = 2, minScore = 1) {
  return Object.entries(scoreMap)
    .filter(([, v]) => v >= minScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

function getWeekContext(date = new Date()) {
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const isWeekend = day === 0 || day === 6;
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
  return { day, dayName, isWeekend, weekMode: isWeekend ? "weekend" : "weekday" };
}

function getSeason(date = new Date()) {
  const m = date.getMonth(); // 0..11
  // Northern hemisphere generic; still harmless wording (we won't force seasonal phrasing).
  if (m === 11 || m === 0 || m === 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "fall";
}

function computeTimeframe(timeTheme = "night", date = new Date()) {
  const { day, isWeekend } = getWeekContext(date);

  // Base defaults
  let timeframe = "today";
  let timeframe_next = "tomorrow";
  let timeframe_end = "tonight";

  // Time-of-day nuance
  if (timeTheme === "morning") {
    timeframe = "today";
    timeframe_next = "today";
    timeframe_end = "tonight";
  } else if (timeTheme === "afternoon" || timeTheme === "evening") {
    timeframe = "today";
    timeframe_next = "tomorrow";
    timeframe_end = "tonight";
  } else {
    // night
    timeframe = "today";
    timeframe_next = "tomorrow";
    timeframe_end = "tomorrow starts";
  }

  // Week rhythm nuance (subtle)
  // Friday evening/night: "the weekend starts"
  if ((timeTheme === "evening" || timeTheme === "night") && day === 5) {
    timeframe_end = "the weekend starts";
  }
  // Sunday evening/night: "the week begins"
  if ((timeTheme === "evening" || timeTheme === "night") && day === 0) {
    timeframe_end = "the week begins";
  }

  // Weekend morning: keep "today", but don’t push “tomorrow” into “week” language (avoid corny)
  if (isWeekend && timeTheme === "morning") {
    timeframe_next = "today";
  }

  return { timeframe, timeframe_next, timeframe_end };
}

function moodToTone(promptMoodTrend = []) {
  const trend = Array.isArray(promptMoodTrend) ? promptMoodTrend : [];
  if (trend.includes("anxious")) return "gentle";
  if (trend.includes("stuck")) return "neutral";
  if (trend.includes("grateful")) return "upbeat";
  return "gentle";
}

function detectModes({ recentEntries, avgWordsPerEntry, tokensAll, sentimentTrend }) {
  const modes = new Set();

  // Low-signal: too short, or too few entries
  if ((recentEntries || []).length < 2 || avgWordsPerEntry < 12) modes.add("lowSignal");

  // Task mode: lots of list-like structure / admin keywords
  // (light heuristic; no OCR/format parsing)
  if (/(^|\n)\s*[-*]\s+/.test(tokensAll.join(" ")) || countKeywordHits(tokensAll, ["todo", "to-do", "checklist"]) > 0) {
    modes.add("taskMode");
  }

  // Third-person heavy: few first-person tokens, more third-person tokens
  const firstPerson = countKeywordHits(tokensAll, ["i", "me", "my", "mine", "myself"]);
  const thirdPerson = countKeywordHits(tokensAll, ["he", "she", "they", "them", "his", "her", "their"]);
  if (thirdPerson >= 4 && thirdPerson > firstPerson * 2) modes.add("thirdPersonHeavy");

  // Sensitive mode
  if (countKeywordHits(tokensAll, SENSITIVE_HINTS) > 0) modes.add("sensitiveMode");

  // Positive mode
  if (sentimentTrend >= 3) modes.add("positiveMode");

  return [...modes];
}

function computeDomainActivation(domainScores, domainStrongHits, recentTokensJoined) {
  // Multi-signal activation:
  // - either: >=2 strong hits
  // - or: 1 strong + >=2 weak
  // - or: >=4 total hits AND at least 1 strong
  const active = new Set();

  for (const domain of Object.keys(domainScores)) {
    const total = domainScores[domain] || 0;
    const strong = domainStrongHits[domain] || 0;

    // prevent "school" via ambiguous "class" alone
    const hasStudyButNoStrongSchool = domain === "school" && strong === 0 && /\bclass\b/.test(recentTokensJoined);
    if (hasStudyButNoStrongSchool) continue;

    if (strong >= 2) active.add(domain);
    else if (strong >= 1 && total >= 3) active.add(domain);
    else if (strong >= 1 && total >= 4) active.add(domain);
  }

  return [...active];
}

function buildSnapshot(entries = []) {
  const now = new Date();
  const timeTheme = getTimeTheme(now);
  const timeBucket = getTimeBucket(now);
  const week = getWeekContext(now);
  const season = getSeason(now);
  const month = now.getMonth() + 1;

  const recent = [...(Array.isArray(entries) ? entries : [])]
    .sort((a, b) => timeKey(b) - timeKey(a))
    .slice(0, 12);

  const tf = computeTimeframe(timeTheme, now);

  let totalWords = 0;

  const domainScores = Object.fromEntries(Object.keys(DOMAIN_KEYWORDS).map((k) => [k, 0]));
  const domainStrongHits = Object.fromEntries(Object.keys(DOMAIN_KEYWORDS).map((k) => [k, 0]));
  const actionScores = Object.fromEntries(Object.keys(ACTION_KEYWORDS).map((k) => [k, 0]));
  const stateScores = Object.fromEntries(Object.keys(STATE_HINTS).map((k) => [k, 0]));

  const moodCounts = new Map();
  const promptMoodCounts = new Map();

  // Aggregate tokens across recent entries (for modes)
  const tokensAll = [];
  let sentimentSum = 0;
  let sentimentN = 0;

  for (const e of recent) {
    const content = (e?.content || "").toString();
    const tokens = tokenize(content);
    tokensAll.push(...tokens);
    totalWords += tokens.length;

    // Mood tracking
    const moodStored = (e?.mood || "").toString().trim();
    if (moodStored) moodCounts.set(moodStored, (moodCounts.get(moodStored) || 0) + 1);

    const promptMood =
      normalizePromptMood(e?.mood || e?.mood_tag || e?.moodLabel) ||
      inferMoodFromText(content);
    if (promptMood) promptMoodCounts.set(promptMood, (promptMoodCounts.get(promptMood) || 0) + 1);

    // Domain scoring (multi-signal)
    for (const [domain, parts] of Object.entries(DOMAIN_KEYWORDS)) {
      const strong = countKeywordHits(tokens, parts.strong || []);
      const weak = countKeywordHits(tokens, parts.weak || []);
      domainStrongHits[domain] += strong;
      domainScores[domain] += strong * 2 + weak; // strong weighs more
    }

    // Action + state scoring
    for (const [action, keys] of Object.entries(ACTION_KEYWORDS)) {
      actionScores[action] += countKeywordHits(tokens, keys);
    }
    for (const [state, keys] of Object.entries(STATE_HINTS)) {
      stateScores[state] += countKeywordHits(tokens, keys);
    }

    // Sentiment trend (lightweight)
    try {
      const analyzer = new Sentiment();
      const res = analyzer.analyze(content || "");
      const score = typeof res.score === "number" ? res.score : 0;
      sentimentSum += score;
      sentimentN += 1;
    } catch {
      // ignore
    }
  }

  // --- RECENT DOMAIN ACTIVITY (Last 12 Hours) ---
  const twelveHoursAgo = now.getTime() - 12 * 60 * 60 * 1000;
  const recentWorkActivity = recent.some(e => {
    const t = timeKey(e);
    if (t < twelveHoursAgo) return false;
    const toks = tokenize(e.content || "");
    const workStrong = countKeywordHits(toks, DOMAIN_KEYWORDS.work.strong);
    const schoolStrong = countKeywordHits(toks, DOMAIN_KEYWORDS.school.strong);
    return workStrong >= 1 || schoolStrong >= 1;
  });

  const avgWordsPerEntry = recent.length ? Math.round(totalWords / recent.length) : 0;
  const promptMoodTrend = [...promptMoodCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const tone = moodToTone(promptMoodTrend);
  const actions = pickTopKeys(actionScores, 2, 1);
  const states = pickTopKeys(stateScores, 2, 1);

  const tokensJoined = tokenString(tokensAll);

  // Activated domains (strict)
  const activeDomains = computeDomainActivation(domainScores, domainStrongHits, tokensJoined);

  // If none, stay general.
  // If work or school is weak/ambiguous, prefer responsibilities over guessing.
  let domains = activeDomains.length ? activeDomains : ["general"];

  // If both work+school active, keep both (fine).
  // If neither is active but "plan" actions exist, allow responsibilities.
  if (domains.includes("general") && actions.includes("plan")) {
    domains = ["responsibilities", "general"];
  }

  // Confidence: entries + length + strong-domain activation + action signal
  const strongDomainCount = activeDomains.filter((d) => (domainStrongHits[d] || 0) >= 1).length;
  const signalScore =
    (recent.length >= 6 ? 2 : recent.length >= 3 ? 1 : 0) +
    (avgWordsPerEntry >= 35 ? 2 : avgWordsPerEntry >= 18 ? 1 : 0) +
    (strongDomainCount >= 1 ? 1 : 0) +
    (actions.length ? 1 : 0);

  const confidence = Math.max(0, Math.min(1, signalScore / 6));

  const sentimentTrend = sentimentN ? Math.round(sentimentSum / sentimentN) : 0;
  const modes = detectModes({
    recentEntries: recent,
    avgWordsPerEntry,
    tokensAll,
    sentimentTrend,
  });

  // Week gating: if weekend and work/school not strongly active, downrank them later
  const weekMode = week.weekMode;

  return {
    timeBucket,
    timeTheme,
    entryCount: recent.length,
    avgWordsPerEntry,
    confidence,
    topMoods: [...moodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k),
    promptMoodTrend,
    // compatibility fields expected by Home.jsx
    topThemes: [],
    topKeywords: [],
    entryHints: [],
    recentSnippets: [],
    // new fields used internally
    snapshot: {
      domains,
      actions,
      states,
      tone,
      modes,
      weekMode,
      dayName: week.dayName,
      isWeekend: week.isWeekend,
      month,
      season,
      sentimentTrend,
      ...tf,
      recentWorkActivity, // New field for strict gating
    },
  };
}

export function buildPromptContext(entries = []) {
  return buildSnapshot(entries);
}

/* =========================================================
   3) Prompt assembly + selection (non-repeat friendly)
   - Adds: mode gating + weekend gating + intent diversity
   ========================================================= */

function normalizePromptKey(promptText) {
  return (promptText || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
}

const BANNED_META_TOKENS = new Set([
  "prompt", "prompts", "shuffle", "reflekt", "chatgpt", "assistant", "system", "model", "cache", "version", "code", "app", "entry", "journal", "journaling"
]);

function validatePrompt(text) {
  const s = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return false;

  const lower = s.toLowerCase();
  if (!lower.endsWith("?")) return false;

  // Avoid meta leakage
  const parts = lower.split(/[^a-z0-9]+/g).filter(Boolean);
  if (parts.some((p) => BANNED_META_TOKENS.has(p))) return false;

  // Avoid vague "things" prompts (common nonsense root)
  if (/\bthings\b/.test(lower)) return false;

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 5 || words.length > 20) return false;

  const qm = (s.match(/\?/g) || []).length;
  if (qm > 1) return false;

  // Avoid unresolved braces in final prompt
  if (/\{[^}]+\}/.test(s)) return false;

  if (/undefined|null/i.test(s)) return false;
  return true;
}

// Template text validation: allows only the 3 placeholders
function validateTemplateText(templateText) {
  const s = (templateText || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (!s.endsWith("?")) return false;

  // Only allow these placeholders, if any
  const badPlaceholder = /\{(?!timeframe|timeframe_next|timeframe_end)[^}]+\}/.test(s);
  if (badPlaceholder) return false;

  // Meta words in template text are still not allowed
  const lower = s.toLowerCase();
  if (/\b(prompt|app|journal|chatgpt|assistant|system|model|cache|code|entry)\b/.test(lower)) return false;

  // Prevent obviously vague templates
  if (/\bthings\b/.test(lower)) return false;

  // Word count (roughly; placeholders count as tokens but that’s fine)
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 5 || words.length > 22) return false;

  return true;
}

function renderTemplate(text, snapshot) {
  const safe = (v) => (v || "").toString();
  const out = (text || "")
    .replaceAll("{timeframe}", safe(snapshot.timeframe))
    .replaceAll("{timeframe_next}", safe(snapshot.timeframe_next))
    .replaceAll("{timeframe_end}", safe(snapshot.timeframe_end));
  return out.replace(/\s+/g, " ").trim();
}

function templateMatches(tpl, snapshot) {
  const domains = snapshot.domains || ["general"];
  const actions = snapshot.actions || [];
  const states = snapshot.states || [];
  const tone = snapshot.tone || "gentle";
  const modes = Array.isArray(snapshot.modes) ? snapshot.modes : [];
  const weekMode = snapshot.weekMode || "weekday";

  const tplDomains = Array.isArray(tpl.domains) ? tpl.domains : ["general"];
  const tplActions = Array.isArray(tpl.actions) ? tpl.actions : [];
  const tplStates = Array.isArray(tpl.states) ? tpl.states : [];
  const tplTones = Array.isArray(tpl.tones) ? tpl.tones : ["gentle"];

  // Mode gating (by rule, not by endless phrase bans)
  // Sensitive mode: prefer support/rest/grounding and avoid probing domains.
  if (modes.includes("sensitiveMode")) {
    const allowedActions = new Set(["support", "rest", "release", "plan", "boundaries"]);
    if (tplActions.length && !tplActions.some((a) => allowedActions.has(a))) return false;
  }

  // Low-signal: keep general/responsibilities only
  if (modes.includes("lowSignal")) {
    const allowedDomains = new Set(["general", "responsibilities", ...domains.filter((d) => d !== "general")]);
    if (!tplDomains.some((d) => allowedDomains.has(d))) return false;
  }

  // Weekend gating: if weekend AND work/school not active RECENTLY (12h), don’t show work/school templates.
  if (weekMode === "weekend") {
    const isWorkLikeTpl = tplDomains.includes("work") || tplDomains.includes("school");
    // Only allow if user explicitly wrote about work/school in the last 12 hours
    if (isWorkLikeTpl && !snapshot.recentWorkActivity) return false;
  }

  // Morning gating: No "end of day" phrasing in the morning
  if (snapshot.timeTheme === "morning") {
    const lowerText = tpl.text.toLowerCase();
    // Block past-tense "today" reflection
    if (lowerText.includes("today") && (lowerText.includes("drained") || lowerText.includes("happened") || lowerText.includes("stick with you") || lowerText.includes("felt meaningful"))) return false;
    // Block end-of-day specific phrasing
    if (lowerText.includes("leave behind") || lowerText.includes("put down") || lowerText.includes("before you rest") || lowerText.includes("from today")) return false;
  }

  // Third-person heavy: avoid intimate relationship assumptions; focus on self-boundary/support
  if (modes.includes("thirdPersonHeavy")) {
    const disallowedDomains = new Set(["relationships"]);
    if (tplDomains.some((d) => disallowedDomains.has(d))) {
      const safeRelActions = new Set(["boundaries", "support", "reframe"]);
      if (!tplActions.some((a) => safeRelActions.has(a))) return false;
    }
  }

  // Positive mode: avoid overly heavy stress framing
  if (modes.includes("positiveMode")) {
    if (tplDomains.includes("stress") && tplActions.includes("rest")) return false;
  }

  const domainOk =
    tplDomains.includes("general") ||
    tplDomains.some((d) => (domains || []).includes(d));

  const actionOk = !tplActions.length || tplActions.some((a) => actions.includes(a));
  const stateOk = !tplStates.length || tplStates.some((s) => states.includes(s));
  const toneOk = !tplTones.length || tplTones.includes(tone) || tplTones.includes("gentle");

  // Require at least one of action/state match unless template is general
  const hasIntentMatch = actionOk || stateOk || tplDomains.includes("general") || tplDomains.includes("responsibilities");

  return domainOk && hasIntentMatch && toneOk;
}

function scoreTemplate(tpl, snapshot, usedIntents = new Set()) {
  let score = 1;

  const domains = snapshot.domains || ["general"];
  const actions = snapshot.actions || [];
  const states = snapshot.states || [];
  const tone = snapshot.tone || "gentle";
  const timeTheme = snapshot.timeTheme || "day";
  const weekMode = snapshot.weekMode || "weekday";

  const tplDomains = Array.isArray(tpl.domains) ? tpl.domains : [];
  const tplActions = Array.isArray(tpl.actions) ? tpl.actions : [];
  const tplStates = Array.isArray(tpl.states) ? tpl.states : [];
  const tplTones = Array.isArray(tpl.tones) ? tpl.tones : [];

  // 1. Basic matching
  if (tplDomains.some((d) => domains.includes(d))) score += 1.1;
  if (tplActions.some((a) => actions.includes(a))) score += 0.9;
  if (tplStates.some((s) => states.includes(s))) score += 0.7;
  if (tplTones.includes(tone)) score += 0.4;

  // 2. Time-of-day Context Hints
  // Morning: Bias towards planning, intention, values
  if (timeTheme === "morning") {
    if (tplActions.some((a) => ["plan", "values", "intent", "focus"].includes(a))) score += 0.4;
    // slightly demote heavy reflection in morning
    if (tplActions.includes("reflect")) score -= 0.1;
  }

  // Evening/Night: Bias towards reflection, gratitude, release, rest
  if (timeTheme === "evening" || timeTheme === "night") {
    if (tplActions.some((a) => ["reflect", "gratitude", "release", "rest", "support"].includes(a))) score += 0.4;
    // slightly demote planning in evening (unless it's "tomorrow")
    if (tplActions.includes("plan") && !tpl.text.includes("tomorrow")) score -= 0.1;
  }

  // 3. Day-of-week Context Hints
  // Weekend: Bias towards rest, relationships, values, general life
  if (weekMode === "weekend") {
    if (tplDomains.some((d) => ["relationships", "general", "self", "health"].includes(d))) score += 0.3;
    if (tplActions.includes("rest")) score += 0.3;
    // Demote strict work planning on weekends (unless user is in work mode explicitly)
    if (tplDomains.includes("work") && !domains.includes("work")) score -= 0.4;
  }

  // Monday (special check): Boost planning/responsibilities slightly
  if (weekMode === "weekday" && snapshot.dayName === "Monday") {
    if (tplActions.includes("plan") || tplDomains.includes("responsibilities")) score += 0.2;
  }

  // 4. Mood Echoing (AI Logic 2.0)
  // If the prompt mood trend is negative (bad/awful), boost 'support', 'reframe', 'comfort'
  const isNegativeState = snapshot.sentimentTrend < 0 || (snapshot.promptMoodTrend || []).some(m => ["bad", "awful", "stress", "anxious"].includes(m));
  if (isNegativeState) {
    if (tplActions.some(a => ["support", "rest", "reframe", "boundaries"].includes(a))) score += 0.5;
    if (tplTones.includes("gentle")) score += 0.3;
    // Demote "challenging" prompts
    if (tplActions.includes("plan") || tplActions.includes("values")) score -= 0.1;
  }

  // If positive state, boost gratitude and values
  const isPositiveState = snapshot.sentimentTrend > 2 || (snapshot.promptMoodTrend || []).includes("great");
  if (isPositiveState) {
    if (tplActions.some(a => ["gratitude", "values", "plan"].includes(a))) score += 0.4;
  }

  // Intent diversity: penalize repeating the same action/intent within a batch
  const primaryIntent = tplActions[0] || "";
  if (primaryIntent && usedIntents.has(primaryIntent)) score -= 0.55;

  return Math.max(0.05, score);
}

function weightedPick(items, weightFn) {
  if (!items.length) return null;
  if (items.length === 1) return items[0];

  const rows = items.map((it) => ({ it, w: Math.max(0.05, weightFn(it)) }));
  const total = rows.reduce((sum, r) => sum + r.w, 0);
  let n = Math.random() * total;
  for (const r of rows) {
    n -= r.w;
    if (n <= 0) return r.it;
  }
  return rows[rows.length - 1].it;
}

function buildPromptBatchFromTemplates(context, excludeKeys = new Set(), max = 12) {
  const snapshot = context?.snapshot || {
    domains: ["general"],
    actions: [],
    states: [],
    tone: "gentle",
    modes: [],
    weekMode: "weekday",
    timeframe: "today",
    timeframe_next: "tomorrow",
    timeframe_end: "tonight",
  };

  // Filter by gating rules first
  const candidates0 = TEMPLATE_LIBRARY.filter((tpl) => templateMatches(tpl, snapshot));

  // If nothing matches, broaden to safe core (general + responsibilities only)
  const broadened =
    candidates0.length
      ? candidates0
      : TEMPLATE_LIBRARY.filter((t) => (t.domains || []).includes("general") || (t.domains || []).includes("responsibilities"));

  const out = [];
  const seenTpl = new Set();
  const usedIntents = new Set();

  while (out.length < max && seenTpl.size < broadened.length) {
    const pick = weightedPick(
      broadened.filter((t) => !seenTpl.has(t.id)),
      (t) => scoreTemplate(t, snapshot, usedIntents)
    );
    if (!pick) break;

    seenTpl.add(pick.id);

    const rendered = renderTemplate(pick.text, snapshot);
    const key = normalizePromptKey(rendered);

    if (!key || excludeKeys.has(key)) continue;
    if (!validatePrompt(rendered)) continue;

    // Track intent diversity (use first action)
    const primaryIntent = Array.isArray(pick.actions) ? pick.actions[0] : "";
    if (primaryIntent) usedIntents.add(primaryIntent);

    excludeKeys.add(key);
    out.push(rendered);
  }

  // As a last resort, add proven universal prompts
  if (out.length < max) {
    const universals = [
      "What is on your mind right now?",
      "How are you feeling in this exact moment?",
      "What would be a relief to get out of your head?",
    ];
    for (const p of universals) {
      const key = normalizePromptKey(p);
      if (!excludeKeys.has(key) && validatePrompt(p)) {
        excludeKeys.add(key);
        out.push(p);
        if (out.length >= max) break;
      }
    }
  }

  return out.slice(0, max);
}

/* =========================================================
   4) Compatibility exports used by Home.jsx
   ========================================================= */

export function getPromptCandidates(entriesForSignal = []) {
  const ctx = buildPromptContext(entriesForSignal);
  const excludeKeys = new Set();
  return buildPromptBatchFromTemplates(ctx, excludeKeys, 20);
}

export function getContextualFallbackPrompts(entries = []) {
  const ctx = buildPromptContext(entries);
  const excludeKeys = new Set();
  return buildPromptBatchFromTemplates(ctx, excludeKeys, 24);
}

/* =========================================================
   5) Stats-based weighting (kept compatible)
   ========================================================= */

function getPromptPerf(stats, promptText) {
  const raw = stats?.[promptText];
  if (!raw || typeof raw !== "object") return { shown: 0, completed: 0, totalWords: 0 };
  return {
    shown: Number(raw.shown || 0),
    completed: Number(raw.completed || 0),
    totalWords: Number(raw.totalWords || 0),
  };
}

function scorePrompt(stats, promptText) {
  const perf = getPromptPerf(stats, promptText);
  const completionRate = perf.completed / Math.max(1, perf.shown);
  const avgWords = perf.completed > 0 ? perf.totalWords / perf.completed : 0;
  const qualityBoost = Math.min(avgWords, 220) / 160;
  const completionBoost = completionRate * 0.8;
  const explorationBoost = Math.max(0, 0.35 - perf.shown * 0.07);
  return 1 + qualityBoost + completionBoost + explorationBoost;
}

function weightedPickPrompt(items, scoreFn) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];

  const weighted = items.map((item) => ({ item, weight: Math.max(0.05, scoreFn(item)) }));
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  let n = Math.random() * total;
  for (const row of weighted) {
    n -= row.weight;
    if (n <= 0) return row.item;
  }
  return weighted[weighted.length - 1].item;
}

export function pickPersonalizedFromPool(pool = [], exclude, promptStats = {}) {
  const choices = Array.isArray(pool) ? pool.filter((p) => p && p !== exclude) : [];
  const candidates = choices.length > 0 ? choices : pool || [];
  if (!candidates.length) return "";
  return weightedPickPrompt(candidates, (p) => scorePrompt(promptStats, p));
}

export function pickPrompt(exclude, entriesForSignal = [], promptStats = {}) {
  const pool = getPromptCandidates(entriesForSignal);
  const excludeList = Array.isArray(exclude) ? exclude : [exclude];
  const choices = pool.filter((p) => !excludeList.includes(p));
  const candidates = choices.length > 0 ? choices : pool;
  if (candidates.length === 0) return "";
  return weightedPickPrompt(candidates, (p) => scorePrompt(promptStats, p));
}

export function markPromptShown(stats, promptText) {
  if (!promptText) return stats;
  const perf = getPromptPerf(stats, promptText);
  return {
    ...(stats || {}),
    [promptText]: {
      ...perf,
      shown: perf.shown + 1,
      lastShownAt: Date.now(),
    },
  };
}

export function markPromptCompleted(stats, promptText, content) {
  if (!promptText) return stats;
  const perf = getPromptPerf(stats, promptText);
  return {
    ...(stats || {}),
    [promptText]: {
      ...perf,
      completed: perf.completed + 1,
      totalWords: perf.totalWords + (content ? content.trim().split(/\s+/).filter(Boolean).length : 0),
      lastCompletedAt: Date.now(),
    },
  };
}

/* =========================================================
   6) Optional AI expansion (safe)
   - Generates NEW templates (not raw prompts)
   - If Ollama is missing, engine still works perfectly.
   ========================================================= */

const TEMPLATE_SCHEMA_INSTRUCTION = [
  "You write short journal question templates in second-person voice.",
  "Return ONLY valid JSON: {\"templates\":[{\"id\":\"ai_x\",\"domains\":[...],\"actions\":[...],\"tones\":[...],\"text\":\"...\"}]}",
  "Text must be a single question template containing ONLY these placeholders (optional): {timeframe}, {timeframe_next}, {timeframe_end}.",
  "No names, no private details, no meta/UI words (prompt/app/journal/chatgpt/system/model/cache/code/entry).",
  "Templates must be grammar-safe without inserting user phrases.",
  "Word count 5–22. End with '?'.",
  "Allowed domains: work, school, relationships, health, money, life_admin, self, stress, responsibilities, general.",
  "Allowed actions: reflect, plan, boundaries, rest, support, gratitude, reframe, values, release.",
  "Allowed tones: gentle, neutral, upbeat, direct.",
].join("\n");

const EXPANDED_TEMPLATE_CACHE = new Map();
const EXPANDED_TEMPLATE_TTL_MS = 20 * 60 * 1000;
const EXPANDED_TEMPLATE_CACHE_MAX_KEYS = 40;

function snapshotCacheKey(snapshot = {}) {
  const domains = Array.isArray(snapshot.domains) ? snapshot.domains.join("|") : "";
  const actions = Array.isArray(snapshot.actions) ? snapshot.actions.join("|") : "";
  const states = Array.isArray(snapshot.states) ? snapshot.states.join("|") : "";
  const modes = Array.isArray(snapshot.modes) ? snapshot.modes.join("|") : "";
  const weekMode = snapshot.weekMode || "weekday";
  return `${domains}::${actions}::${states}::${modes}::${weekMode}::${snapshot.tone || "gentle"}::${snapshot.timeframe || "today"}::${snapshot.timeframe_next || "tomorrow"}::${snapshot.timeframe_end || "tonight"}`;
}

function dedupeTemplates(templates = []) {
  const byId = new Map();
  for (const t of templates) {
    if (!t || typeof t !== "object") continue;
    const id = (t.id || "").toString().trim();
    const text = (t.text || "").toString().trim();
    if (!id || !text) continue;
    if (!byId.has(id)) byId.set(id, t);
  }
  return [...byId.values()];
}

function pruneExpandedTemplateCache(now = Date.now()) {
  for (const [k, v] of EXPANDED_TEMPLATE_CACHE.entries()) {
    if (!v || typeof v !== "object" || now - Number(v.at || 0) > EXPANDED_TEMPLATE_TTL_MS) {
      EXPANDED_TEMPLATE_CACHE.delete(k);
    }
  }
  if (EXPANDED_TEMPLATE_CACHE.size <= EXPANDED_TEMPLATE_CACHE_MAX_KEYS) return;
  const rows = [...EXPANDED_TEMPLATE_CACHE.entries()].sort(
    (a, b) => Number(a[1]?.at || 0) - Number(b[1]?.at || 0)
  );
  const toDrop = EXPANDED_TEMPLATE_CACHE.size - EXPANDED_TEMPLATE_CACHE_MAX_KEYS;
  for (let i = 0; i < toDrop; i += 1) {
    EXPANDED_TEMPLATE_CACHE.delete(rows[i][0]);
  }
}

function sanitizeTemplateCandidate(tpl) {
  if (!tpl || typeof tpl !== "object") return null;
  const id = (tpl.id || "").toString().trim();
  const text = (tpl.text || "").toString().trim();
  const domains = Array.isArray(tpl.domains) ? tpl.domains.map(String) : [];
  const actions = Array.isArray(tpl.actions) ? tpl.actions.map(String) : [];
  const tones = Array.isArray(tpl.tones) ? tpl.tones.map(String) : [];

  if (!id || id.length < 3) return null;
  if (!validateTemplateText(text)) return null;

  // meta words (extra defense)
  const lower = text.toLowerCase();
  if (/\b(prompt|app|journal|chatgpt|assistant|system|model|cache|code|entry)\b/.test(lower)) return null;

  // disallow hedging domains in one template (prevents "work or school" forever)
  if (/\bwork\s+or\s+school\b/i.test(text)) return null;

  return { id, domains, actions, tones, text };
}

async function ollamaCall({ endpoint, model, prompt, signal }) {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      keep_alive: "30m",
      options: { temperature: 0.5, top_p: 0.9 },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Ollama ${model} failed (${resp.status}): ${errText}`);
  }
  return resp.json();
}

const DEFAULT_MODEL_CANDIDATES = ["gemma3:4b", "llama3.2:3b"];
const DEFAULT_ENDPOINT_CANDIDATES = [
  "/api/ollama/api/generate",
  "http://127.0.0.1:11434/api/generate",
  "http://localhost:11434/api/generate",
];

function sanitizeTitleCandidate(raw) {
  const s = (raw || "")
    .toString()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^\s*[-*•\d.)]+\s*/, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/^[a-zA-Z]\s+/, "")
    .replace(/^["']|["']$/g, "")
    .replace(/[.?!,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (/\b(prompt|shuffle|reflekt|assistant|system|model|cache|code)\b/.test(lower)) return "";
  if (/^(and|but|so|or|of|to|for|the|a|an)\b/.test(lower)) return "";
  if (s.length < 3 || s.length > 72) return "";
  const wordCount = s.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || wordCount > 5) return "";
  return s;
}

function softenTitleCandidate(raw) {
  const s = sanitizeTitleCandidate(raw);
  if (!s) return "";
  const lower = s.toLowerCase();

  const replacements = [
    [/absolutely nothing/gi, "Low Energy"],
    [/stopped trying/gi, "Feeling Disconnected"],
    [/hollowed out/gi, "Emotionally Drained"],
    [/dull ache/gi, "Heavy Mood"],
    [/heavy/gi, "Strained"],
    [/dream life/gi, "Good Day"],
    [/everything .* turns to gold/gi, "Things Going Well"],
    [/massive opportunity/gi, "New Opportunity"],
    [/completely energized/gi, "Energized"],
    [/abundant/gi, "Steady"],
  ];

  let next = s;
  for (const [pattern, value] of replacements) {
    next = next.replace(pattern, value);
  }

  const toned = next.replace(/\s+/g, " ").trim();
  const tonedLower = toned.toLowerCase();
  if (/\b(ruined|hopeless|broken|empty inside|dead inside)\b/.test(tonedLower)) return "";
  return sanitizeTitleCandidate(toned);
}

const TITLE_DOMAIN_KEYWORDS = {
  work: [
    "work", "job", "office", "manager", "coworker", "team", "meeting", "deadline", "project", "client",
  ],
  school: [
    "school", "class", "study", "homework", "assignment", "exam", "professor", "teacher", "course",
  ],
  relationships: [
    "partner", "relationship", "boyfriend", "girlfriend", "friend", "family", "roommate", "parent",
  ],
  money: [
    "money", "budget", "bill", "rent", "debt", "paycheck", "expense", "income",
  ],
  health: [
    "health", "sleep", "energy", "exercise", "therapy", "doctor", "anxiety", "stress", "burnout",
  ],
};

const TITLE_SITUATION_PATTERNS = [
  { key: "meeting with manager", re: /\b(meeting|1:1|one on one).*(manager|boss)\b|\b(manager|boss).*(meeting|1:1|one on one)\b/i },
  { key: "team meeting", re: /\b(team meeting|standup|sync)\b/i },
  { key: "project deadline", re: /\b(project|deadline|deliverable)\b/i },
  { key: "exam prep", re: /\b(exam|test|quiz|midterm|finals?)\b/i },
  { key: "assignment pressure", re: /\b(assignment|homework)\b/i },
  { key: "friend tension", re: /\b(friend|friends).*(tension|argument|fight|distance)\b|\b(tension|argument|fight|distance).*(friend|friends)\b/i },
  { key: "family pressure", re: /\b(family|parent|parents)\b.*(pressure|argument|fight|stress)|\b(pressure|argument|fight|stress).*(family|parent|parents)\b/i },
  { key: "relationship check-in", re: /\b(partner|relationship|boyfriend|girlfriend)\b/i },
  { key: "money stress", re: /\b(money|budget|bill|rent|debt)\b/i },
  { key: "sleep and energy", re: /\b(sleep|tired|exhausted|energy)\b/i },
];

const TITLE_TONE_KEYWORDS = [
  "stress", "stressed", "overwhelmed", "drained", "exhausted", "tired", "lonely",
  "anxious", "pressure", "disappointed", "hopeful", "grateful", "energized", "calm", "focused",
];

const TITLE_QUIRKY_OBJECT_WORDS = new Set([
  "peanut", "butter", "cereal", "chicken", "freezer", "kitchen", "wall", "spoon", "fork",
]);

function toTitleCase(text = "") {
  return (text || "")
    .toString()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleSignalFromContent(content = "") {
  const text = (content || "").toString().toLowerCase();
  const tokens = tokenize(text);
  const tokenSet = new Set(tokens);

  const domainTokens = new Set();
  for (const keys of Object.values(TITLE_DOMAIN_KEYWORDS)) {
    for (const key of keys) {
      const parts = key.toLowerCase().split(/\s+/).filter(Boolean);
      for (const p of parts) domainTokens.add(p);
    }
  }

  const toneTokens = new Set(TITLE_TONE_KEYWORDS);
  const situation = detectSituationLabel(text);
  const topDomain = detectTitleDomain(text, tokens);

  return { tokenSet, domainTokens, toneTokens, situation, topDomain };
}

function scoreTitleRelevance(title = "", signal = null) {
  if (!signal) return 0;
  const raw = sanitizeTitleCandidate(title);
  if (!raw) return Number.NEGATIVE_INFINITY;
  const lower = raw.toLowerCase();
  const parts = tokenize(lower);
  if (!parts.length) return Number.NEGATIVE_INFINITY;

  let score = 0;

  const domainHits = parts.filter((p) => signal.domainTokens.has(p) && signal.tokenSet.has(p)).length;
  const toneHits = parts.filter((p) => signal.toneTokens.has(p) && signal.tokenSet.has(p)).length;
  score += domainHits * 3;
  score += toneHits * 2;

  if (signal.situation) {
    const situationParts = signal.situation.split(/\s+/).filter(Boolean);
    const sHits = situationParts.filter((p) => lower.includes(p)).length;
    score += sHits * 3;
  }
  if (signal.topDomain && lower.includes(signal.topDomain)) {
    score += 2;
  }

  const quirkyHits = parts.filter((p) => TITLE_QUIRKY_OBJECT_WORDS.has(p)).length;
  const hasNoSignal = domainHits === 0 && toneHits === 0;
  if (quirkyHits > 0 && hasNoSignal) score -= 6;

  // Penalize very short ambiguous titles with no clear overlap to entry signals.
  if (parts.length <= 2 && hasNoSignal) score -= 4;

  return score;
}

function rankAndFilterTitleOptions(options = [], content = "", max = 5) {
  const signal = titleSignalFromContent(content);
  const rows = [...new Set((options || []).map(softenTitleCandidate).filter(Boolean))]
    .map((t) => ({ t, score: scoreTitleRelevance(t, signal) }))
    .filter((row) => Number.isFinite(row.score) && row.score > -4)
    .sort((a, b) => b.score - a.score);
  return rows.map((r) => r.t).slice(0, max);
}

function extractiveTitleSuggestions(content = "", max = 5) {
  const text = (content || "")
    .toString()
    .replace(/\b(it|that|there|here|what|who|where|when|how)['’]s\b/gi, "$1 is")
    .replace(/\b([a-z]+)['’]m\b/gi, "$1 am")
    .replace(/\b([a-z]+)['’]re\b/gi, "$1 are")
    .replace(/\b([a-z]+)['’]ve\b/gi, "$1 have")
    .replace(/\b([a-z]+)n['’]t\b/gi, "$1 not")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return [];
  const rawTokens = tokenize(text);
  if (!rawTokens.length) return [];

  const stop = new Set([
    "i", "im", "ive", "my", "me", "the", "a", "an", "and", "or", "but", "so", "to", "of", "in",
    "on", "at", "for", "with", "this", "that", "it", "is", "are", "was", "were", "be", "been",
    "being", "today", "already", "just", "really", "very", "completely", "through", "right",
    "s", "am", "have", "had", "not", "getting", "honestly", "okay", "about", "their", "people", "anyone",
  ]);
  const weakWords = new Set([
    "woke", "feeling", "feel", "going", "meet", "someone", "touch", "turns", "coming", "best",
    "truly",
  ]);

  const phrases = [];
  const seen = new Set();
  const addPhrase = (arr) => {
    const phrase = arr.join(" ").trim();
    if (!phrase || seen.has(phrase)) return;
    const parts = phrase.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 5) return;
    if (parts[0].length < 3) return;
    if (parts.some((p) => p.length <= 1)) return;
    if (parts.some((p) => stop.has(p))) return;
    if (weakWords.has(parts[0])) return;
    if (parts.filter((p) => p.length >= 5).length < 1) return;
    seen.add(phrase);
    phrases.push(phrase);
  };

  // Keep natural adjacency by scanning original token windows.
  for (let i = 0; i < rawTokens.length; i += 1) {
    for (let n = 2; n <= 4; n += 1) {
      const chunk = rawTokens.slice(i, i + n);
      if (chunk.length !== n) continue;
      addPhrase(chunk);
      if (phrases.length >= 40) break;
    }
    if (phrases.length >= 40) break;
  }

  // Prefer chunks that look like concrete themes from the entry.
  const scored = phrases
    .map((p) => {
      let score = 0;
      if (/\b(opportunity|productivity|grateful|joyful|abundant|dream|energy|energized|life|focus|momentum)\b/.test(p)) score += 3;
      if (/\b(work|school|money|health|relationship|goal|project|meeting|deadline)\b/.test(p)) score += 2;
      if (/\b(mask|heavy|dull ache|hollowed|pretending|absolutely nothing|stopped trying|dark)\b/.test(p)) score += 4;
      if (/\b(people about|their weekends|made polite|polite conversation)\b/.test(p)) score -= 3;
      score += p.split(/\s+/).filter((w) => w.length >= 6).length;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);

  const candidates = scored
    .map((p) => softenTitleCandidate(toTitleCase(p)))
    .filter(Boolean)
    .slice(0, max);

  return [...new Set(candidates)].slice(0, max);
}

function detectTitleDomain(text = "", tokens = []) {
  const lower = (text || "").toLowerCase();
  const scores = Object.entries(TITLE_DOMAIN_KEYWORDS).map(([domain, keys]) => {
    let score = 0;
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes(" ")) {
        if (lower.includes(keyLower)) score += 2;
      } else if (tokens.includes(keyLower)) {
        score += 1;
      }
    }
    return [domain, score];
  });
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]?.[1] > 0 ? scores[0][0] : "";
}

function detectSituationLabel(text = "") {
  const lower = (text || "").toLowerCase();
  for (const row of TITLE_SITUATION_PATTERNS) {
    if (row.re.test(lower)) return row.key;
  }
  return "";
}

function situationTitleBase(label = "") {
  if (!label) return "";
  if (label === "sleep and energy") return "Low Energy Tonight";
  return toTitleCase(label);
}

function domainTitleOptions(domain = "", { positiveMode = false, negativeMode = false } = {}) {
  if (domain === "work") {
    return positiveMode
      ? ["Good Momentum at Work", "Workday Wins", "Work Felt Lighter Today"]
      : negativeMode
        ? ["Work Stress Check-In", "Tough Day at Work", "Work Pressure Today"]
        : ["Work Check-In", "Work and Energy", "Work Priorities Today"];
  }
  if (domain === "school") {
    return positiveMode
      ? ["School Progress Today", "Steady School Momentum", "Learning Went Well"]
      : negativeMode
        ? ["School Stress Check-In", "Study Pressure Today", "School Felt Heavy"]
        : ["School Check-In", "Study and Focus", "School Priorities Today"];
  }
  if (domain === "relationships") {
    return positiveMode
      ? ["Feeling More Connected", "Connection Went Well", "Relationship Win Today"]
      : negativeMode
        ? ["Connection Felt Hard", "Relationship Check-In", "Boundary and Connection"]
        : ["Connection Check-In", "Relationships Today", "People and Energy"];
  }
  if (domain === "money") {
    return positiveMode
      ? ["Money Felt Clearer", "Steadier with Money", "Money Progress Today"]
      : negativeMode
        ? ["Money Stress Check-In", "Money Pressure Today", "Getting Clear on Money"]
        : ["Money Check-In", "Budget and Priorities", "Money and Peace of Mind"];
  }
  if (domain === "health") {
    return positiveMode
      ? ["Energy Felt Better", "Feeling Stronger Today", "Health Win Today"]
      : negativeMode
        ? ["Low Energy Check-In", "Energy and Recovery", "Health Felt Heavy"]
        : ["Health Check-In", "Energy and Balance", "Taking Care of Yourself"];
  }
  return positiveMode
    ? ["A Good Day to Build On", "Steady Positive Momentum", "Feeling Good Today"]
    : negativeMode
      ? ["A Hard Day Check-In", "A Small Step Forward", "Where You Are Today"]
      : ["A Meaningful Check-In", "Where You Are Today", "Today in Reflection"];
}

function fallbackTitleSuggestions(content = "", currentTitle = "") {
  const text = (content || "").toString().replace(/\s+/g, " ").trim();
  if (!text) return [];
  const extractive = extractiveTitleSuggestions(text, 5);
  const tokens = tokenize(text).filter((t) => t.length >= 4);
  let sentimentScore = 0;
  try {
    const analyzer = new Sentiment();
    sentimentScore = Number(analyzer.analyze(text || "").score || 0);
  } catch {
    sentimentScore = 0;
  }
  const positiveMode =
    sentimentScore >= 3 ||
    /\b(grateful|joy|joyful|energized|excited|abundant|dream life|proud|optimistic|inspired)\b/i.test(text);
  const negativeMode =
    sentimentScore <= -2 ||
    /\b(heavy|exhausted|drained|overwhelmed|anxious|stress|stressed|burnout|hard day)\b/i.test(text);
  const topDomain = detectTitleDomain(text, tokens);
  const situation = detectSituationLabel(text);
  const situationBase = situationTitleBase(situation);

  const options = [];
  const safeCurrent = sanitizeTitleCandidate(currentTitle);
  if (safeCurrent) options.push(safeCurrent);

  options.push(...domainTitleOptions(topDomain, { positiveMode, negativeMode }));

  if (situationBase) {
    if (positiveMode) {
      options.push(`${situationBase} Went Well`, `${situationBase} Progress`);
    } else if (negativeMode) {
      options.push(`${situationBase} Felt Hard`, `${situationBase} Check-In`);
    } else {
      options.push(`${situationBase} Check-In`, `Thoughts on ${situationBase}`);
    }
  }

  options.push(...extractive);

  return rankAndFilterTitleOptions(options, text, 5);
}

export function generateTitleSuggestionsLocal({ content = "", currentTitle = "" } = {}) {
  return fallbackTitleSuggestions(content, currentTitle);
}

export async function generateTitleSuggestionsWithOllama({ content = "", currentTitle = "", signal } = {}) {
  const cleanContent = (content || "").toString().replace(/\s+/g, " ").trim();
  if (!cleanContent) return [];

  const prompt = [
    "You write concise journal entry titles.",
    "Return ONLY JSON in this format: {\"titles\":[\"...\",\"...\",\"...\"]}.",
    "Generate exactly 5 title options.",
    "Each title must be 2-5 words, natural, specific, and non-robotic.",
    "Ground titles in concrete wording from the entry whenever possible.",
    "Match the emotional tone of the entry.",
    "If the entry is positive/hopeful, titles must sound positive but grounded.",
    "If the entry is heavy, titles can be grounding but not dramatic.",
    "No emojis, no quotes, no numbering, no markdown, no colons.",
    "Avoid meta words like prompt, app, AI, assistant, model, system, cache, code.",
    "Use second-person neutral journal style (not clickbait).",
    "Current title (may be empty):",
    currentTitle || "",
    "Entry content:",
    cleanContent.slice(0, 2500),
  ].join("\\n");

  for (const endpoint of DEFAULT_ENDPOINT_CANDIDATES) {
    for (const model of DEFAULT_MODEL_CANDIDATES) {
      try {
        const data = await ollamaCall({ endpoint, model, prompt, signal });
        const text = (data?.response || "").toString().trim();

        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        }

        const rawTitles = Array.isArray(parsed?.titles) ? parsed.titles : [];
        const cleaned = rankAndFilterTitleOptions(rawTitles, cleanContent, 5);
        if (cleaned.length) return cleaned;
      } catch {
        // try next endpoint/model
      }
    }
  }

  return fallbackTitleSuggestions(cleanContent, currentTitle);
}

export async function generatePromptsWithOllama(context, signal) {
  // Home.jsx expects PROMPTS here. We generate them safely from templates.
  // We optionally expand templates with Ollama; never required.

  const ctx = context && typeof context === "object" ? context : buildPromptContext([]);
  const snapshot = ctx.snapshot || {
    domains: ["general"],
    actions: [],
    states: [],
    tone: "gentle",
    modes: [],
    weekMode: "weekday",
    timeframe: "today",
    timeframe_next: "tomorrow",
    timeframe_end: "tonight",
  };

  const baseExclude = new Set();

  // 1) Always produce a safe local batch
  let safeBatch = buildPromptBatchFromTemplates(ctx, baseExclude, 24);

  const cacheKey = snapshotCacheKey(snapshot);
  const now = Date.now();
  pruneExpandedTemplateCache(now);

  const cached = EXPANDED_TEMPLATE_CACHE.get(cacheKey);
  const cachedTemplates =
    cached && now - cached.at <= EXPANDED_TEMPLATE_TTL_MS && Array.isArray(cached.templates)
      ? dedupeTemplates(cached.templates)
      : [];

  // Use cached templates if present
  if (cachedTemplates.length) {
    const tempLibrary = [...TEMPLATE_LIBRARY, ...cachedTemplates];
    const candidates = tempLibrary.filter((tpl) => templateMatches(tpl, snapshot));
    const broadened = candidates.length ? candidates : tempLibrary;

    const out = [];
    const seen = new Set(baseExclude);

    for (const tpl of broadened) {
      const rendered = renderTemplate(tpl.text, snapshot);
      const key = normalizePromptKey(rendered);
      if (!key || seen.has(key)) continue;
      if (!validatePrompt(rendered)) continue;
      seen.add(key);
      out.push(rendered);
      if (out.length >= 24) break;
    }

    safeBatch = [...new Set([...out, ...safeBatch])].slice(0, 24);
  }

  // 2) Optional expansion via Ollama
  const confidence = typeof ctx.confidence === "number" ? ctx.confidence : 0.3;
  const modes = Array.isArray(snapshot.modes) ? snapshot.modes : [];

  // Do NOT expand when low-signal or sensitive (keeps behavior predictable + safe)
  if (confidence < 0.55 || modes.includes("lowSignal") || modes.includes("sensitiveMode") || signal?.aborted) {
    return safeBatch;
  }

  const modelCandidates = DEFAULT_MODEL_CANDIDATES;
  const endpointCandidates = DEFAULT_ENDPOINT_CANDIDATES;

  const expansionPrompt = [
    TEMPLATE_SCHEMA_INSTRUCTION,
    "",
    "User snapshot (choose variety, do not overfit):",
    JSON.stringify({
      domains: snapshot.domains,
      actions: snapshot.actions,
      tone: snapshot.tone,
      weekMode: snapshot.weekMode,
      modes: snapshot.modes,
      timeframe: snapshot.timeframe,
      timeframe_next: snapshot.timeframe_next,
      timeframe_end: snapshot.timeframe_end,
    }),
    "",
    "Create 10 templates with unique ids (prefix ai_), diverse stems, and safe phrasing.",
    "Never guess school unless the domain is exactly ['school'] in the snapshot.",
    "Never use 'work or school' wording. If unclear, use 'responsibilities'.",
  ].join("\n");

  let newTemplates = [];
  try {
    for (const endpoint of endpointCandidates) {
      for (const model of modelCandidates) {
        try {
          const data = await ollamaCall({ endpoint, model, prompt: expansionPrompt, signal });
          const text = (data?.response || "").toString().trim();

          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) parsed = JSON.parse(m[0]);
          }

          const cand = Array.isArray(parsed?.templates) ? parsed.templates : [];
          const cleaned = cand.map(sanitizeTemplateCandidate).filter(Boolean);

          if (cleaned.length) {
            newTemplates = cleaned;
            break;
          }
        } catch {
          // try next
        }
      }
      if (newTemplates.length) break;
    }
  } catch {
    // no-op
  }

  const mergedTemplates = dedupeTemplates([...cachedTemplates, ...newTemplates]);
  if (mergedTemplates.length) {
    EXPANDED_TEMPLATE_CACHE.set(cacheKey, {
      at: now,
      templates: mergedTemplates.slice(-80),
    });
    pruneExpandedTemplateCache(now);

    const tempLibrary = [...TEMPLATE_LIBRARY, ...mergedTemplates];

    const candidates = tempLibrary.filter((tpl) => templateMatches(tpl, snapshot));
    const broadened = candidates.length ? candidates : tempLibrary;

    const out = [];
    const seen = new Set(baseExclude);

    for (const tpl of broadened) {
      const rendered = renderTemplate(tpl.text, snapshot);
      const key = normalizePromptKey(rendered);
      if (!key || seen.has(key)) continue;
      if (!validatePrompt(rendered)) continue;
      seen.add(key);
      out.push(rendered);
      if (out.length >= 24) break;
    }

    safeBatch = [...new Set([...out, ...safeBatch])]
      .filter((p) => validatePrompt(p))
      .slice(0, 24);
  }

  return safeBatch;
}
