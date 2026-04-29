import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Sparkles, Users } from "lucide-react";
import bgImage from "figma:asset/d571ab94c972a42774418c81ee3ff78236af1305.png";
import { registerCommunity } from "../../api";
import { setStoredUserSession } from "../../session";

export function CommunityRegister() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    mobileNumber: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await registerCommunity({
        fullName: formData.fullName,
        mobileNumber: formData.mobileNumber,
        username: formData.username,
        password: formData.password,
      });

      setStoredUserSession({
        id: result.id,
        fullName: formData.fullName,
        email: result.email,
        role: "community",
        username: formData.username,
        mobileNumber: formData.mobileNumber,
        communityCoins: 0,
        communityLifetimeCoins: 0,
        lastCommunityRewardAt: null,
      });

      navigate("/community/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Community registration failed.");
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
            <Link to="/community/login" className="flex items-center gap-2 text-gray-300 transition-colors hover:text-white">
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
              <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Join The Community</h1>
                <p className="mt-2 text-sm text-gray-300">
                  Community users can only use the forum and reward center. Helpful activity earns small coin rewards.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {[
                { id: "fullName", label: "Full Name", type: "text", placeholder: "Juan Dela Cruz" },
                { id: "mobileNumber", label: "Mobile Number", type: "tel", placeholder: "+63 917 123 4567" },
                { id: "username", label: "Username", type: "text", placeholder: "Choose a username" },
                { id: "password", label: "Password", type: "password", placeholder: "Create a password" },
                { id: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "Re-enter password" },
              ].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="mb-2 block text-sm font-medium text-gray-300">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    name={field.id}
                    type={field.type}
                    value={formData[field.id as keyof typeof formData]}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-white focus:border-[#ff6b3d] focus:outline-none"
                    placeholder={field.placeholder}
                    required
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#ff6b3d] px-5 py-4 font-semibold text-white transition-colors hover:bg-[#ff7a52] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Creating Account..." : "Create Community Account"}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
