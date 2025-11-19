import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name?: string;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

interface AuthState {
  user: User | null;
  selectedOrganizationId: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setSelectedOrganization: (organizationId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      selectedOrganizationId: null,
      isAuthenticated: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          selectedOrganizationId: user?.organizations[0]?.id || null,
        }),
      setSelectedOrganization: (organizationId) =>
        set({ selectedOrganizationId: organizationId }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        set({ user: null, isAuthenticated: false, selectedOrganizationId: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
