import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Coins, Users } from "lucide-react";
import bgImage from "figma:asset/d571ab94c972a42774418c81ee3ff78236af1305.png";
import { loginCommunity } from "../../api";
import { setStoredUserSession } from "../../session";

export function CommunityLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const user = await loginCommunity({ username, password });
      setStoredUserSession({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        username,
        mobileNumber: user.phone ?? "",
        communityCoins: user.communityCoins ?? 0,
        communityLifetimeCoins: user.communityLifetimeCoins ?? 0,
        lastCommunityRewardAt: user.lastCommunityRewardAt ?? null,
      });
      navigate("/community/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Community login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1f2937]">
      <img src={bgImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#111827]/85 backdrop-blur-md" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/10 bg-black/20 px-6 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-gray-300 transition-colors hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </Link>
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b3d]">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-xl font-semibold">Community Hub</span>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/70 p-8 shadow-2xl backdrop-blur-sm md:p-10">
            <div className="mb-8 flex items-start gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Community Login</h1>
                <p className="mt-2 text-sm text-gray-300">
                  Join the forum, help stranded motorists, and slowly build coins for the reward center.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-300">
                  Username or Mobile Number
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white focus:border-[#ff6b3d] focus:outline-none"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white focus:border-[#ff6b3d] focus:outline-none"
                  placeholder="Enter password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#ff6b3d] px-5 py-4 font-semibold text-white transition-colors hover:bg-[#ff7a52] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Signing In..." : "Enter Community Hub"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-300">
              No account yet?{" "}
              <Link to="/community/register" className="font-semibold text-[#ff8a65] hover:underline">
                Register here
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
