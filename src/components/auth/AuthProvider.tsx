"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  accountType: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  features: string[];
  hasFeature: (key: string) => boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ needVerification?: boolean; message?: string }>;
  register: (
    email: string,
    password: string,
    name?: string,
    inviteCode?: string,
    generalKey?: string
  ) => Promise<{
    verificationUrl?: string;
    verificationCode?: string;
    devHint?: string;
  }>;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  loginWithTokens: (data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// 去重并发的 GET 请求
const pendingRequests = new Map<string, Promise<Response>>();

function dedupFetch(url: string, options?: RequestInit): Promise<Response> {
  if (options?.method && options.method !== "GET") {
    return fetch(url, options);
  }

  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)!.then((r) => r.clone());
  }

  const promise = fetch(url, options).finally(() => {
    pendingRequests.delete(url);
  });
  pendingRequests.set(url, promise);
  return promise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [features, setFeatures] = useState<string[]>([]);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // 同步 ref 辅助函数 - 同时更新 state 和 ref
  const _setToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  // 拉取用户功能列表
  const fetchFeatures = useCallback((token: string) => {
    fetch("/api/features", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : { features: [] }))
      .then((data) => setFeatures(data.features || []))
      .catch(() => setFeatures([]));
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // 并发去重：已有 refresh 在执行时复用同一个 Promise
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          setIsLoading(false);
          return null;
        }

        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (res.status === 401) {
          // refresh token 无效，清除
          localStorage.removeItem("refreshToken");
          setUser(null);
          setAccessToken(null);
          setIsLoading(false);
          return null;
        }

        if (!res.ok) {
          setIsLoading(false);
          return null;
        }

        const data = await res.json();
        accessTokenRef.current = data.accessToken;
        setAccessToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem("refreshToken", data.refreshToken);
        setIsLoading(false);

        // 登录/刷新成功后拉取用户功能列表
        fetchFeatures(data.accessToken);

        return data.accessToken;
      } catch {
        // 网络错误不清除 token，下次重试
        setIsLoading(false);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [fetchFeatures]);

  // 初始化：尝试用 refresh token 恢复会话
  useEffect(() => {
    Promise.resolve().then(() => refreshAccessToken());
  }, [refreshAccessToken]);

  const loginWithTokens = useCallback(
    (data: { accessToken: string; refreshToken: string; user: User }) => {
      accessTokenRef.current = data.accessToken;
      setAccessToken(data.accessToken);
      setUser(data.user);
      localStorage.setItem("refreshToken", data.refreshToken);
      // 登录成功后拉取功能列表
      fetchFeatures(data.accessToken);
    },
    [fetchFeatures]
  );

  const hasFeature = useCallback(
    (key: string) => features.includes(key) || features.some(f => f.toLowerCase().includes(key.toLowerCase())),
    [features]
  );

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ needVerification?: boolean; message?: string }> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.needVerification) {
          return { needVerification: true, message: data.error };
        }
        throw new Error(data.error || "Login failed");
      }

      loginWithTokens(data);
      return {};
    },
    [loginWithTokens]
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      name?: string,
      inviteCode?: string,
      generalKey?: string
    ) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, inviteCode, generalKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      return {
        verificationUrl: data.verificationUrl,
        verificationCode: data.verificationCode,
        devHint: data.devHint,
      };
    },
    []
  );

  const logout = useCallback(async () => {
    setUser(null);
    accessTokenRef.current = null;
    setAccessToken(null);
    setFeatures([]);
    localStorage.removeItem("refreshToken");
    pendingRequests.clear();

    // 等待服务端清除 cookie 后再跳转
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 即使失败也继续跳转
    }

    window.location.href = "/login";
  }, []);

  const authFetch = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const token = accessTokenRef.current;
      const headers = new Headers(options?.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const res = await dedupFetch(url, { ...options, headers });

      if (res.status === 401) {
        // 尝试刷新 token
        const newToken = await refreshAccessToken();
        if (newToken) {
          const retryHeaders = new Headers(options?.headers);
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          return fetch(url, { ...options, headers: retryHeaders });
        }
        // 刷新失败，logout 会处理
      }

      return res;
    },
    [refreshAccessToken]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        features,
        hasFeature,
        login,
        register,
        logout,
        refreshAccessToken,
        authFetch,
        loginWithTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
