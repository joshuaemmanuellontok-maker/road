import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Star } from "lucide-react";
import { motion } from "motion/react";

interface SUSSurveyProps {
  onClose: () => void;
  onSubmit: (responses: SUSResponses) => void;
}

export interface SUSResponses {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  feedback: string;
}

export function SUSSurvey({ onClose, onSubmit }: SUSSurveyProps) {
  const [responses, setResponses] = useState<SUSResponses>({
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    q5: 0,
    feedback: "",
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = () => {
    if (
      responses.q1 > 0 &&
      responses.q2 > 0 &&
      responses.q3 > 0 &&
      responses.q4 > 0 &&
      responses.q5 > 0
    ) {
      onSubmit(responses);
    }
  };

  const renderQuestion = (
    key: keyof SUSResponses,
    questionText: string,
    subText: string,
    colorClass: string,
    colorBg: string,
    colorBorder: string
  ) => (
    <div>
      <label className="block text-sm font-semibold text-white mb-3">
        {questionText}
        <span className="text-gray-400 font-normal ml-1">({subText})</span>
      </label>
      <div className="flex items-center justify-between gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => setResponses({ ...responses, [key]: rating })}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              responses[key] === rating
                ? `${colorBorder} ${colorBg}`
                : "border-gray-700 hover:border-gray-600 bg-gray-800"
            }`}
          >
            <Star
              className={`w-8 h-8 mx-auto mb-2 ${
                (responses[key] as number) >= rating
                  ? "text-yellow-500 fill-yellow-500"
                  : "text-gray-600"
              }`}
            />
            <p className="text-xs text-gray-400 text-center">{rating}</p>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mt-2 px-2">
        <span>Strongly Disagree</span>
        <span>Strongly Agree</span>
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 border border-gray-700 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">System Usability Scale (SUS) Feedback</h2>
            <p className="text-gray-400 mt-1">Help us improve KalsadaKonek</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          {renderQuestion("q1", "1. I think that I would like to use this system frequently.", "Frequent Use", "text-[#ff6b3d]", "bg-[#ff6b3d]/20", "border-[#ff6b3d]")}
          {renderQuestion("q2", "2. I found the system unnecessarily complex.", "Complexity", "text-red-500", "bg-red-500/20", "border-red-500")}
          {renderQuestion("q3", "3. I thought the system was easy to use.", "Ease of Use", "text-green-500", "bg-green-500/20", "border-green-500")}
          {renderQuestion("q4", "4. I think that I would need the support of a technical person to be able to use this system.", "Need Support", "text-yellow-500", "bg-yellow-500/20", "border-yellow-500")}
          {renderQuestion("q5", "5. I found the various functions in this system were well integrated.", "Integration", "text-purple-500", "bg-purple-500/20", "border-purple-500")}

          {/* Additional Feedback */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              Additional comments or suggestions (Optional)
            </label>
            <textarea
              value={responses.feedback}
              onChange={(e) => setResponses({ ...responses, feedback: e.target.value })}
              placeholder="Share your experience or suggestions for improvement..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
            >
              Skip for Now
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                responses.q1 === 0 ||
                responses.q2 === 0 ||
                responses.q3 === 0 ||
                responses.q4 === 0 ||
                responses.q5 === 0
              }
              className="flex-1 py-4 bg-[#ff6b3d] text-white rounded-xl font-semibold hover:bg-[#ff5722] transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}