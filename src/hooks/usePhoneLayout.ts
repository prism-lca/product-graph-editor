import { useSyncExternalStore } from "react"

const query = window.matchMedia("(max-width: 620px)")
const subscribe = (callback: () => void) => {
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

export function usePhoneLayout() {
  return useSyncExternalStore(subscribe, () => query.matches)
}
