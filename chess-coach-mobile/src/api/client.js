import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const SESSION_EXPIRED_EVENT = "chess-coach:session-expired";
const sessionExpiredListeners = new Set();

export const api = axios.create({
  baseURL: API_BASE_URL,
});

async function clearToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem("access_token");
  } else {
    await SecureStore.deleteItemAsync("access_token");
  }
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach((listener) => listener());

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

export { SESSION_EXPIRED_EVENT };

api.interceptors.request.use(async (config) => {
  let token = null;

  if (Platform.OS === "web") {
    token = localStorage.getItem("access_token");
  } else {
    token = await SecureStore.getItemAsync("access_token");
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    if (status === 401 && !url.includes("/auth/login")) {
      await clearToken();
      notifySessionExpired();
      router.replace("/auth/login");
    }

    return Promise.reject(error);
  }
);
