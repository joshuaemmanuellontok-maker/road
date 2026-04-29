import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Camera, AlertCircle, Check } from "lucide-react";
import { LogoWithSecret } from "../../components/LogoWithSecret";
import { getEmergencyDraft, setEmergencyDraft } from "../../session";

const mechanicalSymptoms = [
  { id: "flat-tire", label: "Flat Tire", category: "tire" },
  { id: "dead-battery", label: "Dead Battery", category: "electrical" },
  { id: "engine-wont-start", label: "Engine Won't Start", category: "engine" },
  { id: "overheating", label: "Overheating", category: "engine" },
  { id: "strange-noise", label: "Strange Noise", category: "mechanical" },
  { id: "brake-issue", label: "Brake Problem", category: "brake" },
  { id: "fuel-issue", label: "Out of Fuel / Fuel Issue", category: "fuel" },
  { id: "transmission", label: "Transmission Problem", category: "transmission" },
];

export function SymptomTriage() {
  const navigate = useNavigate();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId)
        ? prev.filter((id) => id !== symptomId)
        : [...prev, symptomId]
    );
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  };

  const handleSubmit = () => {
    if (selectedSymptoms.length > 0) {
      const existingDraft = getEmergencyDraft();
      if (existingDraft) {
        setEmergencyDraft({
          ...existingDraft,
          issueSummary: description || selectedSymptoms.join(", "),
          symptoms: selectedSymptoms,
        });
      }
      navigate("/user/finding-agent");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <LogoWithSecret />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Symptom-Based Triage
          </h1>
          <p className="text-sm text-gray-400">
            Select all symptoms to help us match you with the right specialist.
          </p>
        </div>

        <div className="space-y-5">
          {/* Symptom Selection */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <label className="block text-sm font-semibold text-white mb-3">
              What's wrong with your vehicle?
            </label>
            <div className="space-y-2">
              {mechanicalSymptoms.map((symptom) => (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={`w-full p-3 border-2 rounded-lg transition-all text-left flex items-center gap-2.5 ${
                    selectedSymptoms.includes(symptom.id)
                      ? "border-[#ff6b3d] bg-[#ff6b3d]/10"
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedSymptoms.includes(symptom.id)
                        ? "border-[#ff6b3d] bg-[#ff6b3d]"
                        : "border-gray-500"
                    }`}
                  >
                    {selectedSymptoms.includes(symptom.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">
                    {symptom.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <label className="block text-sm font-semibold text-white mb-3">
              Additional Details (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem in more detail..."
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent resize-none placeholder-gray-500"
            />
          </div>

          {/* Photo Upload */}
          <div className="bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-700">
            <label className="block text-sm font-semibold text-white mb-3">
              Upload Photos or Videos (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
              <input
                type="file"
                id="photo-upload"
                accept="image/*,video/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <label
                htmlFor="photo-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="p-3 bg-gray-700 rounded-full">
                  <Camera className="w-6 h-6 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Tap to upload photos or videos
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Help responders diagnose the issue faster
                  </p>
                </div>
              </label>
            </div>
            {photos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-400">
                  {photos.length} file(s) selected
                </p>
              </div>
            )}
          </div>

          {/* Info Alert */}
          <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-500/50 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-100">
              <p className="font-medium mb-0.5">Symptom Classification</p>
              <p>
                Your symptoms will be classified to match you with the most appropriate rescue responder.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={selectedSymptoms.length === 0}
            className="w-full bg-[#ff6b3d] text-white py-4 rounded-xl font-semibold hover:bg-[#ff5722] transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            Find Rescue Responder
          </button>
        </div>
      </main>
    </div>
  );
}
