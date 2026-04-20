import { useState, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Shield, X } from "lucide-react";
import { loginAdmin, saveAdminSession } from "../api";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminLoginModal({ isOpen, onClose }: AdminLoginModalProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const result = await loginAdmin({ username, password });
      saveAdminSession({
        id: result.id,
        username: result.username || username,
        role: result.role,
      });
      navigate("/admin/dashboard");
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-3xl p-8 md:p-12 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close admin login modal"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#ff6b3d]/20 rounded-full mb-4">
            <Shield className="w-8 h-8 text-[#ff6b3d]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-gray-300">Centralized Administrative Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {errorMessage && (
            <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-xl">
              <p className="text-red-400 text-sm">{errorMessage}</p>
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Admin Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent"
              placeholder="Enter admin username"
              required
              disabled={isLoading}
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
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent"
              placeholder="Enter password"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#ff6b3d] hover:bg-[#ff5722] disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold transition-colors shadow-lg"
          >
            {isLoading ? "Signing In..." : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-sm text-gray-400 text-center">
            🔒 Authorized administrators only
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
