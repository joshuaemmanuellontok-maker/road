import { useState } from "react";
import { Link } from "react-router";
import { Car, Wrench, Shield, AlertCircle, Clock, MapPin, Menu, X } from "lucide-react";
import { LogoWithSecret } from "../components/LogoWithSecret";
import bgImage from "figma:asset/d571ab94c972a42774418c81ee3ff78236af1305.png";

export function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#1f2937] relative">
      {/* Background Image with Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 backdrop-blur-md bg-[#1f2937]/80" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="px-4 sm:px-6 py-4 border-b border-white/10 backdrop-blur-sm bg-black/20">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            <Link to="/" className="flex-shrink-0">
              <LogoWithSecret 
                iconContainerClassName="w-10 h-10"
                iconClassName="w-6 h-6"
                textClassName="text-xl sm:text-2xl font-bold"
                className="gap-2 sm:gap-3"
              />
            </Link>

            {/* Desktop Navigation - Show on medium screens and up */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6">
              <a href="#features" className="text-sm lg:text-base text-gray-300 hover:text-white transition-colors whitespace-nowrap">
                Features
              </a>
              <a href="#how-it-works" className="text-sm lg:text-base text-gray-300 hover:text-white transition-colors whitespace-nowrap">
                How It Works
              </a>
              <Link to="/admin/login" className="text-sm lg:text-base text-gray-300 hover:text-white transition-colors whitespace-nowrap">
                Admin Portal
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/admin/login"
                className="border border-white/15 bg-white/5 hover:bg-white/10 text-white px-4 lg:px-5 py-2 lg:py-2.5 rounded-lg text-sm lg:text-base font-semibold transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Admin Login
              </Link>
              <Link
                to="/user/emergency"
                className="bg-[#ff6b3d] hover:bg-[#ff5722] text-white px-4 lg:px-6 py-2 lg:py-2.5 rounded-lg text-sm lg:text-base font-semibold transition-colors shadow-lg flex-shrink-0 whitespace-nowrap items-center justify-center"
              >
                Report Emergency
              </Link>
            </div>

            {/* Mobile Menu Button - Show on small screens only */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-white/10">
              <nav className="flex flex-col gap-3">
                <a
                  href="#features"
                  className="text-gray-300 hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  className="text-gray-300 hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How It Works
                </a>
                <Link
                  to="/admin/login"
                  className="border border-white/15 bg-white/5 text-white px-6 py-3 rounded-lg font-semibold transition-colors text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin Login
                </Link>
                <Link
                  to="/user/emergency"
                  className="bg-[#ff6b3d] hover:bg-[#ff5722] text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg text-center mt-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Report Emergency
                </Link>
              </nav>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-6 py-20 max-w-6xl">
          <div className="text-center mb-20">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
              Ready to Rescue or Be<br />Rescued?
            </h1>
            <p className="text-xl text-gray-200 mb-12 max-w-2xl mx-auto leading-relaxed drop-shadow">
              Join RoadResQ today. Whether you're a motorist or a service provider, we've got you covered.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/user/login"
                className="w-full sm:w-auto bg-[#ff6b3d] hover:bg-[#ff5722] text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-xl"
              >
                Get Help Now
              </Link>
              <Link
                to="/agent/login"
                className="w-full sm:w-auto bg-white hover:bg-gray-100 text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-xl"
              >
                Register as Agent
              </Link>
              <Link
                to="/admin/login"
                className="w-full sm:w-auto border border-white/15 bg-white/10 hover:bg-white/15 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-xl flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Open Admin Portal
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-20">
            <Link
              to="/user/login"
              className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#ff6b3d] transition-colors"
            >
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-lg flex items-center justify-center mb-4">
                <Car className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Motorist Access</h3>
              <p className="text-gray-300 leading-relaxed">
                Sign in to request help, submit emergency reports, and track live rescue status.
              </p>
            </Link>
            <Link
              to="/agent/login"
              className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#ff6b3d] transition-colors"
            >
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-lg flex items-center justify-center mb-4">
                <Wrench className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Agent Access</h3>
              <p className="text-gray-300 leading-relaxed">
                Sign in as a responder to manage availability, receive dispatches, and navigate to jobs.
              </p>
            </Link>
            <Link
              to="/admin/login"
              className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#ff6b3d] transition-colors"
            >
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Admin Access</h3>
              <p className="text-gray-300 leading-relaxed">
                Open the admin portal for dispatch oversight, approvals, analytics, and operations.
              </p>
            </Link>
          </div>

          {/* Feature Highlights */}
          <div id="features" className="grid md:grid-cols-3 gap-6 mb-20">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#ff6b3d] transition-colors">
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Proximity-Based Matching</h3>
              <p className="text-gray-300 leading-relaxed">
                Instantly connects you with the nearest available rescue agent using smart location technology
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#ff6b3d] transition-colors">
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-lg flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Symptom-Based Triage</h3>
              <p className="text-gray-300 leading-relaxed">
                Smart system categorizes your vehicle issue for faster resolution and proper agent matching
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#ff6b3d] transition-colors">
              <div className="w-12 h-12 bg-[#ff6b3d]/20 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-[#ff6b3d]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">SLA Tracking</h3>
              <p className="text-gray-300 leading-relaxed">
                Real-time tracking with service level agreements for accountability and transparency
              </p>
            </div>
          </div>

          {/* How It Works Section */}
          <div id="how-it-works" className="mb-20">
            <h2 className="text-4xl font-bold text-white text-center mb-12 drop-shadow-lg">How It Works</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {/* For Motorists */}
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <Car className="w-8 h-8 text-[#ff6b3d]" />
                  <h3 className="text-2xl font-bold text-white">For Motorists</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Report Emergency</h4>
                      <p className="text-gray-300 text-sm">Share your location and select service type</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Describe the Issue</h4>
                      <p className="text-gray-300 text-sm">Select symptoms for accurate matching</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Get Matched</h4>
                      <p className="text-gray-300 text-sm">Nearest agent is dispatched to your location</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Track in Real-Time</h4>
                      <p className="text-gray-300 text-sm">Monitor agent arrival and service progress</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* For Agents */}
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <Wrench className="w-8 h-8 text-[#ff6b3d]" />
                  <h3 className="text-2xl font-bold text-white">For Service Agents</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Register & Verify</h4>
                      <p className="text-gray-300 text-sm">Submit credentials for accreditation</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Go Online</h4>
                      <p className="text-gray-300 text-sm">Toggle availability to receive requests</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Accept Dispatch</h4>
                      <p className="text-gray-300 text-sm">Review details and accept nearby jobs</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#ff6b3d] rounded-full flex items-center justify-center text-white font-bold">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Provide Service</h4>
                      <p className="text-gray-300 text-sm">Navigate, assist, and complete the job</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-yellow-600/30 backdrop-blur-sm border border-yellow-500/50 rounded-xl p-4 text-center">
            <p className="text-yellow-100 text-sm">
              ⚠️ <strong>Important:</strong> RoadResQ is for automotive repair and transport rescue only. 
              For medical emergencies or accidents with injuries, please contact local emergency services (911 or LGU hotlines).
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 backdrop-blur-sm bg-black/20 py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#ff6b3d] rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-semibold">RoadResQ</span>
              </div>
              <p className="text-gray-300 text-sm">&copy; 2026 RoadResQ | Serving Laguna Province</p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-gray-300 hover:text-white text-sm transition-colors">Privacy Policy</a>
                <a href="#" className="text-gray-300 hover:text-white text-sm transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
