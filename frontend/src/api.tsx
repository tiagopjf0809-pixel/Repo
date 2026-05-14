/**
 * API client and AuthContext.
 */
import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 60000,
});

const TOKEN_KEY = "lumi_token";
const USER_KEY = "lumi_user";

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export type LumiUser = {
  id: string;
  email: string;
  full_name?: string;
  style_identity?: string | null;
  style_filter?: string;
  style_description?: string;
};

type AuthCtx = {
  user: LumiUser | null;
  loading: boolean;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LumiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const tok = await AsyncStorage.getItem(TOKEN_KEY);
      if (!tok) {
        setLoading(false);
        return;
      }
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (e) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signup = async (email: string, password: string, fullName?: string) => {
    const res = await api.post("/auth/signup", { email, password, full_name: fullName });
    await AsyncStorage.setItem(TOKEN_KEY, res.data.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem(TOKEN_KEY, res.data.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
