import axios from "axios";

const defaultApiBaseUrl =
  process.env.NODE_ENV === "development"
    ? `${window.location.protocol}//${window.location.hostname}:8000/api/`
    : "/api/";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || defaultApiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default api;
