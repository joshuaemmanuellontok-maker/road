import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Wrench, ArrowLeft, Upload, CheckCircle } from "lucide-react";
import bgImage from "figma:asset/d571ab94c972a42774418c81ee3ff78236af1305.png";
import { registerAgentApplication, type CredentialFilePayload } from "../../api";

export function AgentRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"info" | "credentials">("info");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    ownerName: "",
    mobileNumber: "",
    serviceCategories: [] as string[],
    serviceArea: "",
    username: "",
    password: "",
  });
  const [credentials, setCredentials] = useState({
    driversLicense: null as File | null,
    vehicleRegistration: null as File | null,
    insurance: null as File | null,
    nbiClearance: null as File | null,
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const toggleServiceCategory = (category: string) => {
    setFormData((current) => ({
      ...current,
      serviceCategories: current.serviceCategories.includes(category)
        ? current.serviceCategories.filter((item) => item !== category)
        : [...current.serviceCategories, category],
    }));
  };

  const handleFileUpload = (field: keyof typeof credentials, file: File | null) => {
    setCredentials({
      ...credentials,
      [field]: file,
    });
  };

  const handleSubmitInfo = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

     if (formData.serviceCategories.length === 0) {
      setErrorMessage("Select at least one service category.");
      return;
    }

    setStep("credentials");
  };

  const handleSubmitCredentials = async (e: FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setErrorMessage("");

    try {
      const credentialFiles = Object.fromEntries(
        await Promise.all(
          Object.entries(credentials).map(async ([key, file]) => [
            key,
            file ? await toCredentialPayload(file) : null,
          ]),
        ),
      ) as Record<string, CredentialFilePayload | null>;

      await registerAgentApplication({
        ...formData,
        serviceCategory: formData.serviceCategories[0] ?? "",
        credentialManifest: {
          driversLicense: credentials.driversLicense?.name ?? "",
          vehicleRegistration: credentials.vehicleRegistration?.name ?? "",
          insurance: credentials.insurance?.name ?? "",
          nbiClearance: credentials.nbiClearance?.name ?? "",
        },
        credentialFiles: Object.fromEntries(
          Object.entries(credentialFiles).filter(([, value]) => value !== null),
        ) as Record<string, CredentialFilePayload>,
      });

      alert("Application submitted! Admin will review your credentials.");
      navigate("/agent/login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Responder registration failed.");
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
            <Link
              to={step === "info" ? "/agent/login" : "#"}
              onClick={(e) => {
                if (step === "credentials") {
                  e.preventDefault();
                  setStep("info");
                }
              }}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
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
          <div className="bg-gray-900/70 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 w-full max-w-2xl shadow-2xl">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  step === "info" ? "bg-[#ff6b3d] text-white" : "bg-[#ff6b3d]/30 text-[#ff6b3d]"
                }`}>
                  {step === "credentials" ? <CheckCircle className="w-6 h-6" /> : "1"}
                </div>
                <div className="w-16 h-1 bg-gray-700">
                  <div className={`h-full bg-[#ff6b3d] transition-all ${
                    step === "credentials" ? "w-full" : "w-0"
                  }`}></div>
                </div>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  step === "credentials" ? "bg-[#ff6b3d] text-white" : "bg-gray-700 text-gray-400"
                }`}>
                  2
                </div>
              </div>
            </div>

            {step === "info" ? (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Responder Registration</h1>
                <p className="text-gray-300 mb-8">Step 1: Business Information</p>

                <form onSubmit={handleSubmitInfo} className="space-y-5">
                  <div>
                    <label htmlFor="ownerName" className="block text-sm font-medium text-gray-300 mb-2">
                      Owner's Full Name
                    </label>
                    <input
                      id="ownerName"
                      name="ownerName"
                      type="text"
                      value={formData.ownerName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-300 mb-2">
                      Mobile Number
                    </label>
                    <input
                      id="mobileNumber"
                      name="mobileNumber"
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                      placeholder="+63 917 123 4567"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Service Categories
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ["mechanic", "Mechanic / Talyer"],
                        ["vulcanizing", "Vulcanizing Shop"],
                        ["towing", "Transport Rescue / Towing"],
                      ].map(([value, label]) => {
                        const active = formData.serviceCategories.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleServiceCategory(value)}
                            className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                              active
                                ? "border-[#ff6b3d] bg-[#ff6b3d]/20 text-white"
                                : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-600"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {formData.serviceCategories.length === 0 ? (
                      <p className="mt-2 text-xs text-gray-500">Select at least one service.</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="serviceArea" className="block text-sm font-medium text-gray-300 mb-2">
                      Service Area Coverage
                    </label>
                    <input
                      id="serviceArea"
                      name="serviceArea"
                      type="text"
                      value={formData.serviceArea}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                      placeholder="e.g., San Pablo City, Alaminos, Bay"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                        Username
                      </label>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                        Password
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#ff6b3d] focus:border-transparent backdrop-blur-sm"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#ff6b3d] hover:bg-[#ff5722] text-white py-4 rounded-xl font-semibold transition-colors shadow-lg"
                  >
                    Continue to Credential Upload
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-white mb-2">Credential Submission</h1>
                <p className="text-gray-300 mb-8">Step 2: Upload Required Documents</p>

                <form onSubmit={handleSubmitCredentials} className="space-y-5">
                  {errorMessage ? (
                    <div className="rounded-xl border border-red-500/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}
                  <CredentialUpload
                    label="Professional Driver's License"
                    required
                    file={credentials.driversLicense}
                    onFileChange={(file) => handleFileUpload("driversLicense", file)}
                  />
                  <CredentialUpload
                    label="Vehicle Registration (OR/CR)"
                    required
                    file={credentials.vehicleRegistration}
                    onFileChange={(file) => handleFileUpload("vehicleRegistration", file)}
                  />
                  <CredentialUpload
                    label="Proof of Insurance"
                    required
                    file={credentials.insurance}
                    onFileChange={(file) => handleFileUpload("insurance", file)}
                  />
                  <CredentialUpload
                    label="NBI Clearance"
                    required
                    file={credentials.nbiClearance}
                    onFileChange={(file) => handleFileUpload("nbiClearance", file)}
                  />

                  <div className="bg-yellow-600/20 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/50">
                    <p className="text-sm text-yellow-100">
                      ℹ️ All documents will be reviewed by system administrators. You'll be notified once your application is approved.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#ff6b3d] hover:bg-[#ff5722] text-white py-4 rounded-xl font-semibold transition-colors shadow-lg"
                  >
                    {submitting ? "Submitting..." : "Submit Application"}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function toCredentialPayload(file: File): Promise<CredentialFilePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Failed to read ${file.name}.`));
        return;
      }

      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        dataUrl: reader.result,
      });
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read ${file.name}.`));
    };

    reader.readAsDataURL(file);
  });
}

function CredentialUpload({
  label,
  required,
  file,
  onFileChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors bg-gray-900/30 backdrop-blur-sm">
        <input
          type="file"
          id={`upload-${label}`}
          accept="image/*,.pdf"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          className="hidden"
          required={required}
        />
        <label
          htmlFor={`upload-${label}`}
          className="cursor-pointer flex items-center gap-3"
        >
          <div className="p-2 bg-gray-800 rounded-lg">
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            {file ? (
              <p className="text-sm text-[#ff6b3d] font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-gray-400">Click to upload (PDF or Image)</p>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
