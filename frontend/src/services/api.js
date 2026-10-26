import axios from "axios";

const api = axios.create({
  baseURL: "",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginAttempt = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
