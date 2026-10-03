import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  ChevronDownIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient.js";
import {
  createLocalEntry,
  deleteLocalEntry,
  endLocalSession,
  getLocalSession,
  listLocalEntries,
  startLocalSession,
  updateLocalSessionName,
  updateLocalEntry,
} from "./lib/localJournalStore.js";

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [storageMode, setStorageMode] = useState("supabase");
  const [bootLoading, setBootLoading] = useState(true);

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const searchWrapRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );

  const location = useLocation();
  const navigate = useNavigate();
  const hideTabs = location.pathname.startsWith("/auth");

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const arr = Array.isArray(entries) ? entries : [];
    return arr
      .filter((e) => {
        const title = (e?.title || "").toLowerCase();
        const content = (e?.content || "").toLowerCase();
        return title.includes(q) || content.includes(q);
      })
      .slice(0, 24);
  }, [entries, searchQuery]);

  function closeSearch() {
    if (!isDesktop) setSearchOpen(false);
    setSearchQuery("");
  }

  function openSearch() {
    if (isDesktop) {
      setSearchOpen(true);
      return;
    }
    setSearchOpen((prev) => !prev);
  }

  function formatEntryDate(iso) {
    const d = new Date(iso || "");
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getEntryExcerpt(content) {
    const text = (content || "").replace(/\s+/g, " ").trim();
    if (!text) return "No content";
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  }

  async function handleLogout() {
    try {
      if (storageMode === "local") {
        endLocalSession();
      } else {
        await supabase?.auth.signOut();
      }
    } finally {
      setSession(null);
      navigate("/auth", { replace: true });
    }
  }

  function enterLocalMode(name) {
    const localSession = startLocalSession(name);
    setStorageMode("local");
    setSession(localSession);
    setEntries(listLocalEntries());
    navigate("/dashboard", { replace: true });
  }

  function handleUpdateLocalName(name) {
    const localSession = updateLocalSessionName(name);
    setStorageMode("local");
    setSession(localSession);
  }

  /* ---------------------------
     Auth session boot
  ---------------------------- */
  useEffect(() => {
    let mounted = true;

    async function boot() {
      const localSession = getLocalSession();
      if (localSession) {
        if (!mounted) return;
        setStorageMode("local");
        setSession(localSession);
        setBootLoading(false);
        return;
      }

      if (!isSupabaseConfigured || !supabase) {
        if (!mounted) return;
        setStorageMode("local");
        setSession(null);
        setBootLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) console.warn("getSession error:", error);
      setSession(data?.session ?? null);
      setBootLoading(false);
    }

    boot();

    const { data: sub } = supabase?.auth.onAuthStateChange((_event, newSession) => {
      setStorageMode("supabase");
      setSession(newSession);
    }) || {};

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  /* ---------------------------
     Fetch entries
  ---------------------------- */
  async function fetchEntries(userId) {
    if (!userId) {
      setEntries([]);
      return;
    }

    setEntriesLoading(true);
    try {
      if (storageMode === "local") {
        setEntries(listLocalEntries());
        return;
      }

      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchEntries error:", e);
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }

  useEffect(() => {
    const userId = session?.user?.id;
    fetchEntries(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setSearchOpen(isDesktop);
  }, [isDesktop]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e) => {
      if (!searchWrapRef.current?.contains(e.target)) {
        closeSearch();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  /* ---------------------------
     CRUD
  ---------------------------- */
  async function addEntry(entry) {
    const userId = session?.user?.id;
    if (!userId) throw new Error("Not signed in.");

    const now = new Date().toISOString();

    const payload = {
      user_id: userId,
      title: entry.title || "untitled",
      content: entry.content,
      mood: entry.mood,
      themes: entry.themes,
      created_at: now,
      updated_at: now,
    };

    if (storageMode === "local") {
      const inserted = createLocalEntry(payload);
      setEntries((prev) => [inserted, ...prev]);
      return;
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .insert(payload)
      .select("*");

    if (error) throw error;

    const inserted = Array.isArray(data) ? data : [];
    if (inserted.length) {
      setEntries((prev) => [...inserted, ...prev]);
    } else {
      await fetchEntries(userId);
    }
  }

  async function updateEntry(id, patch) {
    const userId = session?.user?.id;
    if (!userId) throw new Error("Not signed in.");

    const now = new Date().toISOString();
    const updatePayload = { updated_at: now };

    if (patch.title !== undefined) updatePayload.title = patch.title || "untitled";
    if (patch.content !== undefined) updatePayload.content = patch.content;
    if (patch.mood !== undefined) updatePayload.mood = patch.mood;
    if (patch.themes !== undefined) updatePayload.themes = patch.themes;
    if (patch.created_at !== undefined) updatePayload.created_at = patch.created_at;

    if (storageMode === "local") {
      const updated = updateLocalEntry(id, updatePayload);
      if (updated) {
        setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
      return;
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*");

    if (error) throw error;

    const updated = Array.isArray(data) ? data[0] : null;

    if (updated) {
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } else {
      await fetchEntries(userId);
    }
  }

  async function deleteEntry(id) {
    const userId = session?.user?.id;
    if (!userId) throw new Error("Not signed in.");

    if (storageMode === "local") {
      deleteLocalEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      return;
    }

    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  /* ---------------------------
     UI
  ---------------------------- */
  if (bootLoading) {
    return <div className="app-container" />;
  }

  const mobileSearchMode = searchOpen && !isDesktop;

  return (
    <div className="app-container">
      {/* Header */}
      <header className={`app-header ${mobileSearchMode ? "is-search-open-mobile" : ""}`}>
        {/* ✅ width constrained to match your cards */}
        <div className="header-inner">
          <nav className="nav">
            {/* Left: brand */}
            {!mobileSearchMode && (
              <NavLink to="/" className="nav-brand">
                <div className="brand-logo">R</div>
                <div className="brand-name">REFLEKT</div>
              </NavLink>
            )}

            {/* Right: auth actions (hidden on /auth) */}
            {!hideTabs && (
              <div className={`nav-actions ${mobileSearchMode ? "nav-actions--search" : ""}`}>
                {/* Desktop button */}
                {!mobileSearchMode && (!session ? (
                  <NavLink
                    to="/auth"
                    id="authBtn"
                    className="auth-btn auth-btn--login auth-desktop"
                    title="Log in"
                  >
                    <UserCircleIcon width={16} height={16} />
                    Log in
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    id="authBtn"
                    className="auth-btn auth-btn--logout auth-desktop"
                    onClick={handleLogout}
                    title="Log out"
                  >
                    <UserCircleIcon width={16} height={16} />
                    Log out
                  </button>
                ))}

                {session && (
                  <div
                    ref={searchWrapRef}
                    className={`search-inline ${searchOpen ? "is-open" : ""}`}
                  >
                    <input
                      ref={searchInputRef}
                      className="search-inline-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search your entries."
                      aria-label="Search entries"
                    />
                    <button
                      type="button"
                      className="search-icon-btn"
                      onClick={openSearch}
                      title="Search entries"
                      aria-label="Search entries"
                    >
                      <MagnifyingGlassIcon width={18} height={18} />
                    </button>

                    {searchOpen && searchQuery.trim() && (
                      <div className="search-inline-results">
                        {searchResults.length === 0 ? (
                          <div className="small-muted">No matching entries found.</div>
                        ) : (
                          searchResults.map((e) => (
                            <button
                              type="button"
                              key={e.id}
                              className="search-result-item"
                              onClick={() => {
                                navigate("/dashboard");
                                closeSearch();
                              }}
                            >
                              <div className="search-result-title">{e.title || "untitled"}</div>
                              <div className="search-result-meta">{formatEntryDate(e.created_at || e.updated_at)}</div>
                              <div className="search-result-excerpt">{getEntryExcerpt(e.content)}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile: icon dropdown */}
                <details className="auth-mobile" aria-label="Account menu">
                  <summary className="auth-icon-btn" title="Account">
                    <UserCircleIcon width={22} height={22} />
                    <ChevronDownIcon width={16} height={16} />
                  </summary>

                  <div className="auth-dropdown" role="menu">
                    {!session ? (
                      <NavLink to="/auth" className="auth-dd-item" role="menuitem">
                        Log in
                      </NavLink>
                    ) : (
                      <button
                        type="button"
                        className="auth-dd-item"
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        Log out
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Tabs */}
      {!hideTabs && (
        <div className="top-tabs">
          <div className="tabs-wrap">
            <div className="tabs">
              <NavLink
                to="/"
                className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}
              >
                <HomeIcon width={16} height={16} strokeWidth={2.2} />
                <span className="tab-label">Home</span>
              </NavLink>

              <NavLink
                to="/dashboard"
                className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}
              >
                <Squares2X2Icon width={16} height={16} strokeWidth={2.2} />
                <span className="tab-label">Dashboard</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="app-main">
        <div key={location.pathname} className="route-fade">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  session={session}
                  storageMode={storageMode}
                  entries={entries}
                  entriesLoading={entriesLoading}
                  onAddEntry={addEntry}
                  onUpdateEntry={updateEntry}
                  onDeleteEntry={deleteEntry}
                  onUpdateLocalName={handleUpdateLocalName}
                />
              }
            />

            <Route
              path="/auth"
              element={
                session ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Auth
                    supabaseEnabled={isSupabaseConfigured}
                    onUseLocalMode={enterLocalMode}
                  />
                )
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute session={session}>
                  <Dashboard
                    session={session}
                    entries={entries}
                    entriesLoading={entriesLoading}
                    onUpdateEntry={updateEntry}
                    onDeleteEntry={deleteEntry}
                  />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <footer className="app-footer">Reflekt • private journaling</footer>

    </div>
  );
}
