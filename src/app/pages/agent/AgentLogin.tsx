import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Wrench, ArrowLeft } from "lucide-react";
import bgImage from "figma:asset/d571ab94c972a42774418c81ee3ff78236af1305.png";
import { loginAgent } from "../../api";
import { setStoredUserSession } from "../../session";

export function AgentLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const user = await loginAgent({ username, password });
      setStoredUserSession({
        ...user,
        username,
        mobileNumber: (user as any).phone || "",
      });
      navigate("/agent/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1f2937] flex flex-col relative">
      {/* Background Image with Blur */}
      <img
        src={bgImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 backdrop-blur-md bg-[#1f2937]/85" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-6 py-4 border-b border-white/10 backdrop-blur-sm bg-black/20">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <Link to="/" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#ff6b3d] rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">KalsadaKonek Responder</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="bg-gray-900/70 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 w-full max-w-md shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-2">Responder Log In</h1>
            <p className="text-gray-300 mb-8">Access your rescue responder dashboard</p>

            <form onSubmit={handleLogin} className="space-y-6">
              {errorMessage ? (
                <div className="rounded-xl border border-red-500/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                  Responder ID or Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                  placeholder="Enter responder ID"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                  placeholder="Enter password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#ff6b3d] hover:bg-[#ff5722] text-white py-4 rounded-xl font-semibold transition-colors shadow-lg"
              >
                {submitting ? "Signing In..." : "Log In"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-300">
                Not registered yet?{" "}
                <Link to="/agent/register" className="text-[#ff6b3d] font-semibold hover:underline">
                  Apply as Responder
                </Link>
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-sm text-gray-400 text-center">
                Accredited responders only. Registration requires credential verification.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
