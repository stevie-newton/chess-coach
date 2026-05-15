import * as SecureStore from "expo-secure-store";
import { createContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { SESSION_EXPIRED_EVENT, api, onSessionExpired } from "../api/client";

export const AuthContext = createContext();

async function saveToken(token) {
  if (Platform.OS === "web") {
    localStorage.setItem("access_token", token);
  } else {
    await SecureStore.setItemAsync("access_token", token);
  }
}

async function getToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem("access_token");
  }
  return await SecureStore.getItemAsync("access_token");
}

async function removeToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem("access_token");
  } else {
    await SecureStore.deleteItemAsync("access_token");
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToken();
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setToken(null);
    });

    const handleSessionExpired = () => {
      setToken(null);
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    }

    return () => {
      unsubscribe();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      }
    };
  }, []);

  const loadToken = async () => {
    try {
      const savedToken = await getToken();
      setToken(savedToken);
    } catch (error) {
      console.log("Token load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    const accessToken = response.data.access_token;

    await saveToken(accessToken);
    setToken(accessToken);

    return response.data;
  };

  const register = async (payload) => {
    return api.post("/auth/register", payload);
  };

  const logout = async () => {
    await removeToken();
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
