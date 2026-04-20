import { Link } from "react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen bg-[#1f2937] flex items-center justify-center px-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-900/50 rounded-full mb-6 border border-red-500/50">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-200 mb-3">Page Not Found</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff6b3d] text-white rounded-xl font-semibold hover:bg-[#ff5722] transition-colors shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}