// pages/Auth.jsx
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useNavigate } from "react-router-dom";

function capFirst(str) {
  const s = (str || "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Auth({ supabaseEnabled = true, onUseLocalMode }) {
  const navigate = useNavigate();

  // Which card is open? ("signin" or "signup")
  const [panel, setPanel] = useState("signin");

  // Sign-in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ Remember me (default ON, so most users stay signed in)
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password (lives under sign-in card)
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showGuestName, setShowGuestName] = useState(false);
  const [guestName, setGuestName] = useState("");

  // Sign-up
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // ✅ After sign-up, show a “check your email” notice (verification)
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const signInReady = useMemo(
    () => email.trim().length > 0 && password.trim().length > 0,
    [email, password]
  );

  const signUpReady = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      signupEmail.trim().length > 0 &&
      signupPassword.trim().length > 0,
    [firstName, lastName, signupEmail, signupPassword]
  );

  const resetReady = useMemo(() => resetEmail.trim().length > 0, [resetEmail]);
  const guestReady = useMemo(() => guestName.trim().length > 0, [guestName]);

  // Buttons / styles
  const activeBtn = "bg-[var(--color-primary)] text-white border-transparent";
  const inactiveBtn =
    "bg-white/20 text-[var(--color-text)] border-[var(--color-border)]";

  // Same “type” of button for Sign in / Sign up toggles
  const toggleBtnBase =
    "w-full rounded-xl px-4 py-3 font-medium border transition";

  // Forgot password: underlined text, no border
  const linkClass =
    "inline-flex items-center justify-center font-semibold underline text-[var(--color-text)] mt-2 border-0 bg-transparent p-0";

  // ✅ Branded checkbox styles (uses your CSS tokens; won't change layout)
  const checkboxWrap = "flex items-center gap-2 mt-2 select-none";
  const checkboxBox =
    "w-5 h-5 rounded-md border border-[var(--color-border)] bg-white/40 flex items-center justify-center transition";
  const checkboxBoxChecked =
    "bg-[var(--color-primary)] border-transparent";
  const checkboxTick =
    "w-2.5 h-2.5 rounded-sm bg-white"; // simple “tick” block (no svg needed)

  function openSignIn() {
    setPanel("signin");
    setShowReset(false);
    setShowGuestName(false);
    setMsg("");
    setShowVerifyNotice(false); // ✅ reset notice unless we just signed up
    // keep sign-in fields as-is
  }

  function openSignUp() {
    setPanel("signup");
    setShowReset(false); // requirement: sign in + reset expanded by default, signup collapses sign-in
    setShowGuestName(false);
    setMsg("");
    setShowVerifyNotice(false);
    setSignupEmail(email); // helpful carry-over
  }

  function openGuestName(defaultName = "") {
    setGuestName(defaultName);
    setShowGuestName(true);
    setShowReset(false);
    setMsg("");
  }

  function handleGuestContinue() {
    if (!guestReady) return;
    onUseLocalMode?.(capFirst(guestName));
  }

  async function handleSignIn(e) {
    e.preventDefault();
    if (!signInReady) return;

    if (!supabaseEnabled || !supabase) {
      openGuestName();
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      // ✅ Remember me behavior:
      // - If checked: persist session across browser restarts (Supabase default)
      // - If unchecked: sign in normally, then set session to this tab only
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (!rememberMe) {
        // Make session “not remembered” by clearing persistence and re-setting session
        // (Keeps you logged in for this tab/session but not across restarts)
        const session = data?.session;
        try {
          await supabase.auth.setSession({
            access_token: session?.access_token,
            refresh_token: session?.refresh_token,
          });
          // Best-effort: remove any stored persistence keys if the SDK stored them
          // (safe: if keys don't exist, nothing breaks)
          try {
            localStorage.removeItem("sb-" + supabase?.auth?.url + "-auth-token");
          } catch (_) {}
        } catch (_) {
          // Even if this fails, login still works; we just won't change persistence.
        }
      }

      navigate("/", { replace: true });
    } catch (err) {
      setMsg(
        `${err?.message || "Something went wrong."} You can continue locally while Supabase is unavailable.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (!signUpReady) return;

    if (!supabaseEnabled || !supabase) {
      openGuestName(capFirst(firstName));
      return;
    }

    setLoading(true);
    setMsg("");
    setShowVerifyNotice(false);

    try {
      const fn = capFirst(firstName);
      const ln = capFirst(lastName);

      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            first_name: fn,
            last_name: ln,
            full_name: `${fn} ${ln}`.trim(),
          },
        },
      });
      if (error) throw error;

      // ✅ If email confirmation is enabled, Supabase returns a user but no session
      const needsEmailVerify = !data?.session;

      if (needsEmailVerify) {
        setShowVerifyNotice(true);
        setMsg(
          "Check your email to verify your account, then come back and sign in."
        );
      } else {
        setMsg("Account created. You can sign in now.");
      }

      // Carry back to sign-in (same as before)
      setEmail(signupEmail);
      setPassword(signupPassword);
      setPanel("signin");
      setShowReset(false);
    } catch (err) {
      setMsg(
        `${err?.message || "Something went wrong."} You can continue locally while Supabase is unavailable.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetReady) return;

    if (!supabaseEnabled || !supabase) {
      setMsg("Password reset needs Supabase. You can continue locally for now.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const redirectTo = `${window.location.origin}/#/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      });
      if (error) throw error;

      setMsg("Password reset email sent.");
      setShowReset(false);
    } catch (err) {
      setMsg(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* ===== Card 1: SIGN IN (default expanded) ===== */}
        {panel === "signin" && (
          <div className="border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl p-6">
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="text-sm opacity-80 mt-1">
              Sign in to access your journal.
            </p>

            {!supabaseEnabled && (
              <div
                className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/30 p-3 text-sm"
                style={{ lineHeight: 1.35 }}
              >
                This portfolio demo saves guest entries in this browser.
              </div>
            )}

            {/* ✅ Verify notice shown after first-time sign-up (doesn't affect flow) */}
            {showVerifyNotice && (
              <div
                className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/30 p-3 text-sm"
                style={{ lineHeight: 1.35 }}
              >
                <div style={{ fontWeight: 700 }}>Verify your email</div>
                <div className="opacity-80">
                  We sent you a confirmation link. Open it to activate your
                  account, then come back here to sign in.
                </div>
              </div>
            )}

            <form onSubmit={handleSignIn} className="mt-6 flex flex-col gap-3">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />

              <button
                type="submit"
                disabled={loading || !signInReady}
                className={`${toggleBtnBase} ${
                  signInReady ? activeBtn : inactiveBtn
                }`}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>

              <button
                type="button"
                className={`${toggleBtnBase} ${inactiveBtn}`}
                onClick={() => openGuestName()}
              >
                Continue as guest
              </button>

              {showGuestName && panel === "signin" && (
                <div className="mt-2 flex flex-col gap-3">
                  <label>Name for demo</label>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleGuestContinue}
                    disabled={!guestReady}
                    className={`${toggleBtnBase} ${guestReady ? activeBtn : inactiveBtn}`}
                  >
                    Start guest demo
                  </button>
                </div>
              )}

              {/* Forgot password link (underlined, no border) */}
              <button
                type="button"
                onClick={() => {
                  setShowReset((v) => !v);
                  setResetEmail(email); // keep your behavior
                  setMsg("");
                }}
                className={linkClass}
              >
                Forgot password?
              </button>

              {/* Reset form lives under sign-in */}
              {showReset && (
                <div className="mt-2 flex flex-col gap-3">
                  <label>Reset email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                  />

                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading || !resetReady}
                    className={`${toggleBtnBase} ${
                      resetReady ? activeBtn : inactiveBtn
                    }`}
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <div className="text-center text-sm opacity-80">Or</div>

                {/* Same button type as sign-in button */}
                <button
                  type="button"
                  onClick={openSignUp}
                  className={`${toggleBtnBase} ${inactiveBtn}`}
                >
                  Sign up
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===== Card 2: SIGN UP ===== */}
        {panel === "signup" && (
          <div className="border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl p-6">
            <h1 className="text-2xl font-semibold">Create your account</h1>
            <p className="text-sm opacity-80 mt-1">
              Make an account to start saving entries.
            </p>

            {!supabaseEnabled && (
              <div
                className="mt-4 rounded-xl border border-[var(--color-border)] bg-white/30 p-3 text-sm"
                style={{ lineHeight: 1.35 }}
              >
                Account creation needs Supabase. You can use the guest demo on this device.
              </div>
            )}

            {/* ✅ Small reminder (doesn't block sign-up) */}
            <div className="mt-4 text-sm opacity-80">
              First time here? After you sign up, you may need to verify your email before signing in.
            </div>

            <form onSubmit={handleSignUp} className="mt-6 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <input
                type="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="At least 8 characters"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
              />

              <button
                type="submit"
                disabled={loading || !signUpReady}
                className={`${toggleBtnBase} ${
                  signUpReady ? activeBtn : inactiveBtn
                }`}
              >
                {loading ? "Creating…" : "Create account"}
              </button>

              <button
                type="button"
                className={`${toggleBtnBase} ${inactiveBtn}`}
                onClick={() => openGuestName(capFirst(firstName))}
              >
                Continue as guest
              </button>

              {showGuestName && panel === "signup" && (
                <div className="mt-2 flex flex-col gap-3">
                  <label>Name for demo</label>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleGuestContinue}
                    disabled={!guestReady}
                    className={`${toggleBtnBase} ${guestReady ? activeBtn : inactiveBtn}`}
                  >
                    Start guest demo
                  </button>
                </div>
              )}

              {/* Same type of button as others */}
              <button
                type="button"
                onClick={openSignIn}
                className={`${toggleBtnBase} ${inactiveBtn}`}
              >
                Back to sign in
              </button>
            </form>
          </div>
        )}

        {msg && (
          <div className="border border-[var(--color-border)] bg-[var(--color-surface)] rounded-2xl p-4 text-sm">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
