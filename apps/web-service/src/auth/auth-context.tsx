import {
  AuthenticatedUserDto,
  LoginPayload,
  RegisterUserPayload,
  Role,
} from '@call-reservation/shared-types';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authApi } from '../api/auth-api';

export const TOKEN_STORAGE_KEY = 'call-reservation.access-token';

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  token: string | null;
  isLoading: boolean;
  login(payload: LoginPayload): Promise<AuthenticatedUserDto>;
  register(payload: RegisterUserPayload): Promise<AuthenticatedUserDto>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getRolePath(role: Role): '/admin' | '/user' {
  return role === Role.ADMIN ? '/admin' : '/user';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    authApi
      .getCurrentUser(storedToken)
      .then((currentUser) => {
        if (isActive) {
          setUser(currentUser);
          setToken(storedToken);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      async login(payload) {
        const response = await authApi.login(payload);
        localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
        setUser(response.user);
        setToken(response.accessToken);
        return response.user;
      },
      register: authApi.register,
      logout() {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
        setToken(null);
      },
    }),
    [isLoading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
