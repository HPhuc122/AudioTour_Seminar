import { useEffect } from "react"
import { AppState, Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { audioTourApi } from "./api"

const KEY = "audiotour.installation-id"

// An installation identifier, not a hardware identifier or an access credential.
export function useDevicePresence() {
  useEffect(() => {
    let active = true
    let busy = false
    let deviceId: string | null = null
    async function report() {
      if (!active || busy || AppState.currentState !== "active") return
      busy = true
      try {
        if (!deviceId) {
          deviceId = await SecureStore.getItemAsync(KEY)
          if (!active) return
          if (!deviceId) {
            deviceId = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
            await SecureStore.setItemAsync(KEY, deviceId)
          }
        }
        if (active && AppState.currentState === "active")
          await audioTourApi.registerDevice(deviceId, Platform.OS, String(Platform.Version))
      } catch {
        // Presence must not block browsing/audio; retry on the next heartbeat.
      } finally {
        busy = false
      }
    }
    void report()
    const timer = setInterval(() => void report(), 60000)
    const listener = AppState.addEventListener("change", state => {
      if (state === "active") void report()
    })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [])
}
