export interface StoredUserSession {
  id: string;
  fullName: string;
  email: string;
  role: string;
  username: string;
  mobileNumber?: string;
}

export interface EmergencyDraft {
  locationLabel: string;
  latitude: number;
  longitude: number;
  serviceType: "repair" | "transport";
  issueSummary: string;
  symptoms: string[];
}

const USER_SESSION_KEY = "roadresq.userSession";
const EMERGENCY_DRAFT_KEY = "roadresq.emergencyDraft";
const ACTIVE_DISPATCH_KEY = "roadresq.activeDispatch";

function readJson<T>(key: string): T | null {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getStoredUserSession() {
  return readJson<StoredUserSession>(USER_SESSION_KEY);
}

export function setStoredUserSession(session: StoredUserSession) {
  writeJson(USER_SESSION_KEY, session);
}

export function clearStoredUserSession() {
  window.localStorage.removeItem(USER_SESSION_KEY);
}

export function getEmergencyDraft() {
  return readJson<EmergencyDraft>(EMERGENCY_DRAFT_KEY);
}

export function setEmergencyDraft(draft: EmergencyDraft) {
  writeJson(EMERGENCY_DRAFT_KEY, draft);
}

export function clearEmergencyDraft() {
  window.localStorage.removeItem(EMERGENCY_DRAFT_KEY);
}

export function getActiveDispatch() {
  return readJson<{ dispatchId: string }>(ACTIVE_DISPATCH_KEY);
}

export function setActiveDispatch(dispatchId: string) {
  writeJson(ACTIVE_DISPATCH_KEY, { dispatchId });
}

export function clearActiveDispatch() {
  window.localStorage.removeItem(ACTIVE_DISPATCH_KEY);
}
