import { useColorScheme } from 'react-native';
import { useAuth } from '../context/AuthContext';

export const lightColors = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  primary: "#2563EB",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#F59E0B",
};

export const darkColors = {
  bg: "#0F1117",
  card: "#1E293B",
  border: "#334155",
  text: "#F8FAFC",
  muted: "#94A3B8",
  primary: "#3B82F6",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
};

// Se mantiene para compatibilidad con código que aún no usa el hook
export const colors = lightColors;

export function useThemeColors(themePreference?: 'light' | 'dark' | 'system') {
  const systemColorScheme = useColorScheme();

  if (themePreference === 'light') return lightColors;
  if (themePreference === 'dark') return darkColors;

  return systemColorScheme === 'dark' ? darkColors : lightColors;
}

export function useAppColors() {
  const { user } = useAuth();
  return useThemeColors(user?.settings?.theme);
}
