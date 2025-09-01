import { createSignal, Show, createMemo } from 'solid-js';
import { useNotes } from '../../context/NotesContext';

export function Auth() {
  const {
    session,
    user,
    authLoading,
    authError,
    isMfaRequired,
    mfaEnrollmentData,
    signUpWithEmail,
    signInWithEmail,
    verifyMfaChallenge,
    signInWithGoogle,
    signOut,
    startMfaSetup,
    verifyMfaSetup,
    disableMfa,
  } = useNotes();

  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [mfaCode, setMfaCode] = createSignal('');
  const [isSignUpMode, setIsSignUpMode] = createSignal(false);

  // Memo to find the active TOTP factor for the current user
  const activeTotpFactor = createMemo(() => {
    const currentUser = user(); // Get the current user
    // Ensure both currentUser and currentUser.factors exist before attempting to find a factor
    if (!currentUser || !currentUser.factors) {
      return undefined;
    }
    return currentUser.factors.find(f => f.factor_type === 'totp' && f.status === 'verified');
  });


  const handleEmailAuth = async (e: Event) => {
    e.preventDefault();
    if (isSignUpMode()) {
      await signUpWithEmail(email(), password());
    } else {
      await signInWithEmail(email(), password());
    }
  };

  const handleMfaChallenge = async (e: Event) => {
    e.preventDefault();
    await verifyMfaChallenge(mfaCode());
    if (!authError()) { // Clear code only if successful
      setMfaCode('');
    }
  };

  const handleMfaSetupVerify = async (e: Event) => {
    e.preventDefault();
    await verifyMfaSetup(mfaCode());
    if (!authError()) { // Clear code only if successful
      setMfaCode('');
    }
  };

  const handleDisableMfa = async () => {
    if (activeTotpFactor()) {
      await disableMfa(activeTotpFactor()!.id);
    }
  };

  return (
    <div class="space-y-4">
      <Show when={authLoading()}>
        <div class="text-center text-gray-500">Loading authentication state...</div>
      </Show>

      <Show when={authError()}>
        <div class="p-2 bg-red-100 text-red-700 rounded text-sm">
          {authError()}
        </div>
      </Show>

      <Show
        when={!session() || authLoading()} // Show login/signup if no session or loading
        fallback={
          // User is logged in
          <div class="space-y-3">
            <h4 class="text-md font-semibold">Welcome, {user()?.email || 'User'}!</h4>
            <button
              onClick={signOut}
              class="w-full px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              disabled={authLoading()}
            >
              Sign Out
            </button>

            <div class="border-t border-gray-200 pt-3 mt-3">
              <h5 class="text-sm font-medium mb-2">Multi-Factor Authentication (MFA)</h5>
              <Show
                when={!activeTotpFactor() && !mfaEnrollmentData()} // Show enable MFA button if no active TOTP and not in setup
                fallback={
                  <Show when={mfaEnrollmentData()}>
                    {/* MFA Setup in progress */}
                    <p class="text-xs text-gray-600 mb-2">Scan the QR code with your authenticator app and enter the code to verify setup.</p>
                    <div class="flex flex-col items-center justify-center border border-gray-200 rounded p-4 mb-3">
                      <div class="bg-gray-50 p-2 rounded mb-2" innerHTML={mfaEnrollmentData()!.qrCode} />
                      <p class="text-xs font-mono text-gray-700 select-all break-all">Secret: {mfaEnrollmentData()!.secret}</p>
                    </div>
                    <form onSubmit={handleMfaSetupVerify} class="flex gap-2">
                      <input
                        type="text"
                        placeholder="MFA Code"
                        value={mfaCode()}
                        onInput={(e) => setMfaCode(e.target.value)}
                        class="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={authLoading()}
                        inputmode="numeric" pattern="[0-9]*"
                      />
                      <button
                        type="submit"
                        class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        disabled={authLoading()}
                      >
                        Verify Setup
                      </button>
                    </form>
                  </Show>
                }
              >
                {/* Button to start MFA setup */}
                <button
                  onClick={startMfaSetup}
                  class="w-full px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  disabled={authLoading()}
                >
                  Enable MFA (TOTP)
                </button>
              </Show>

              <Show when={activeTotpFactor()}>
                {/* MFA is enabled */}
                <p class="text-xs text-green-700 mt-2">MFA (TOTP) is currently enabled.</p>
                <button
                  onClick={handleDisableMfa}
                  class="w-full mt-3 px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                  disabled={authLoading()}
                >
                  Disable MFA (TOTP)
                </button>
              </Show>
            </div>
          </div>
        }
      >
        {/* Not logged in: Show Login/Signup forms */}
        <Show when={!isMfaRequired()}>
          <form onSubmit={handleEmailAuth} class="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email()}
              onInput={(e) => setEmail(e.target.value)}
              class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={authLoading()}
            />
            <input
              type="password"
              placeholder="Password"
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
              class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={authLoading()}
            />
            <div class="flex items-center justify-between">
              <button
                type="submit"
                class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                disabled={authLoading()}
              >
                {isSignUpMode() ? 'Sign Up' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setIsSignUpMode(!isSignUpMode())}
                class="text-sm text-blue-600 hover:underline"
                disabled={authLoading()}
              >
                {isSignUpMode() ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
          </form>

          <div class="flex items-center my-4">
            <hr class="flex-grow border-gray-300" />
            <span class="px-3 text-gray-500 text-sm">OR</span>
            <hr class="flex-grow border-gray-300" />
          </div>

          <button
            onClick={signInWithGoogle}
            class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            disabled={authLoading()}
          >
            <div class="i-logos:google-icon w-5 h-5" />
            Sign in with Google
          </button>
        </Show>

        <Show when={isMfaRequired()}>
          {/* MFA Challenge (after email+password sign-in returns mfa_required) */}
          <h4 class="text-md font-semibold text-center mb-3">Two-Factor Authentication</h4>
          <p class="text-sm text-gray-600 mb-4 text-center">Enter the code from your authenticator app.</p>
          <form onSubmit={handleMfaChallenge} class="space-y-3">
            <input
              type="text"
              placeholder="MFA Code"
              value={mfaCode()}
              onInput={(e) => setMfaCode(e.target.value)}
              class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={authLoading()}
              inputmode="numeric" pattern="[0-9]*"
            />
            <button
              type="submit"
              class="w-full px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              disabled={authLoading()}
            >
              Verify Code
            </button>
          </form>
        </Show>
      </Show>
    </div>
  );
}