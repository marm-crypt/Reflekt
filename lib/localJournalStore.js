const LOCAL_SESSION_KEY = "reflekt_local_session_v1";
const LOCAL_ENTRIES_KEY = "reflekt_local_entries_v1";
const LOCAL_PASSCODE_KEY = "reflekt_local_passcode_v1";

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function makeSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  return `${Date.now()}-${Math.random()}`;
}

async function hashPasscode(passcode, salt) {
  const value = `${salt}:${passcode}`;
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const encoded = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return bytesToHex(new Uint8Array(digest));
  }
  return btoa(unescape(encodeURIComponent(value)));
}

function createLocalSession(name = "Guest") {
  const displayName = (name || "Guest").trim() || "Guest";
  return {
    access_token: "local-session",
    user: {
      id: "local-user",
      email: "local@reflekt",
      user_metadata: {
        first_name: displayName,
        full_name: displayName,
      },
    },
  };
}

export function getLocalSession() {
  return readJson(LOCAL_SESSION_KEY, null);
}

export function startLocalSession(name) {
  const session = createLocalSession(name);
  writeJson(LOCAL_SESSION_KEY, session);
  return session;
}

export function hasLocalPasscode() {
  const record = readJson(LOCAL_PASSCODE_KEY, null);
  return Boolean(record?.salt && record?.hash);
}

export function getLocalPasscodeName() {
  const record = readJson(LOCAL_PASSCODE_KEY, null);
  return record?.name || "";
}

export async function setLocalPasscode(name, passcode) {
  const cleanPasscode = (passcode || "").trim();
  if (!cleanPasscode) throw new Error("Passcode is required.");
  const displayName = (name || "Guest").trim() || "Guest";
  const salt = makeSalt();
  const hash = await hashPasscode(cleanPasscode, salt);
  const record = {
    name: displayName,
    salt,
    hash,
    updated_at: new Date().toISOString(),
  };
  writeJson(LOCAL_PASSCODE_KEY, record);
  return record;
}

export async function verifyLocalPasscode(passcode) {
  const record = readJson(LOCAL_PASSCODE_KEY, null);
  if (!record?.salt || !record?.hash) return false;
  const hash = await hashPasscode((passcode || "").trim(), record.salt);
  return hash === record.hash;
}

export function updateLocalSessionName(name) {
  const session = getLocalSession() || createLocalSession();
  const displayName = (name || "Guest").trim() || "Guest";
  const nextSession = {
    ...session,
    user: {
      ...session.user,
      user_metadata: {
        ...(session.user?.user_metadata || {}),
        first_name: displayName,
        full_name: displayName,
      },
    },
  };
  writeJson(LOCAL_SESSION_KEY, nextSession);
  return nextSession;
}

export function endLocalSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export function listLocalEntries() {
  const entries = readJson(LOCAL_ENTRIES_KEY, []);
  return Array.isArray(entries)
    ? entries.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
    : [];
}

export function createLocalEntry(entry) {
  const entries = listLocalEntries();
  const now = new Date().toISOString();
  const next = {
    id: crypto?.randomUUID?.() || `local-${Date.now()}`,
    user_id: "local-user",
    title: entry.title || "untitled",
    content: entry.content || "",
    mood: entry.mood,
    mood_confidence: entry.mood_confidence,
    mood_tokens: entry.mood_tokens,
    themes: entry.themes || [],
    created_at: entry.created_at || now,
    updated_at: entry.updated_at || now,
  };
  writeJson(LOCAL_ENTRIES_KEY, [next, ...entries]);
  return next;
}

export function updateLocalEntry(id, patch) {
  const entries = listLocalEntries();
  let updated = null;
  const nextEntries = entries.map((entry) => {
    if (entry.id !== id) return entry;
    updated = {
      ...entry,
      ...patch,
      updated_at: patch.updated_at || new Date().toISOString(),
    };
    return updated;
  });
  writeJson(LOCAL_ENTRIES_KEY, nextEntries);
  return updated;
}

export function deleteLocalEntry(id) {
  const entries = listLocalEntries();
  writeJson(
    LOCAL_ENTRIES_KEY,
    entries.filter((entry) => entry.id !== id)
  );
}
