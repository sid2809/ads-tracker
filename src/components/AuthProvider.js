"use client";
import { createContext, useContext } from "react";

const AuthContext = createContext({ user: { username: "admin", role: "admin" }, loading: false });

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{ user: { username: "admin", role: "admin" }, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
