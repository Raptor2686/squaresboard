export const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    // VITE_API_URL should be the base URL WITHOUT /api suffix
    // e.g. https://squaresboard.onrender.com
    return import.meta.env.VITE_API_URL;
  }
  return "http://localhost:8000";
};

export const API = getApiUrl() + "/api";
