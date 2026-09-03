export const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production builds, default to the live Render backend
  if (import.meta.env.PROD) {
    return "https://squaresboard.onrender.com";
  }
  return "http://localhost:8000";
};

export const API = getApiUrl() + "/api";
