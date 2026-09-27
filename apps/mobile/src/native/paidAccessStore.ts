import * as SecureStore from "expo-secure-store";

const PAID_ACCESS_KEY = "audiotour.paid-access";

export type PaidAccessSession = {
  accessToken: string;
  expiresAt: string;
};

export async function loadPaidAccessSession(): Promise<PaidAccessSession | null> {
  const value = await SecureStore.getItemAsync(PAID_ACCESS_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<PaidAccessSession>;
    return session.accessToken && session.expiresAt
      ? { accessToken: session.accessToken, expiresAt: session.expiresAt }
      : null;
  } catch {
    await SecureStore.deleteItemAsync(PAID_ACCESS_KEY);
    return null;
  }
}

export async function savePaidAccessSession(session: PaidAccessSession): Promise<void> {
  await SecureStore.setItemAsync(PAID_ACCESS_KEY, JSON.stringify(session));
}

export async function clearPaidAccessSession(): Promise<void> {
  await SecureStore.deleteItemAsync(PAID_ACCESS_KEY);
}
