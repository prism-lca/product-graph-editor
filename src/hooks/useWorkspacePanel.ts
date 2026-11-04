import { useEffect, useId, useRef, useState } from "react"

const eventName = "prism:workspace-panel"

/** Coordinate peer workspace panels, without interfering with nested controls. */
export function useWorkspacePanel() {
  const [open, setOpen] = useState(false)
  const id = useId()
  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false)
    }
    window.addEventListener(eventName, closeOther)
    return () => window.removeEventListener(eventName, closeOther)
  }, [id])
  return [open, (next: boolean) => {
    if (next) window.dispatchEvent(new CustomEvent(eventName, { detail: id }))
    setOpen(next)
  }] as const
}

export function useSelectionPanel(open: boolean, close: () => void) {
  const id = useId()
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent(eventName, { detail: id }))
    const dismiss = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) closeRef.current()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current()
    }
    window.addEventListener(eventName, dismiss)
    window.addEventListener("keydown", escape)
    return () => {
      window.removeEventListener(eventName, dismiss)
      window.removeEventListener("keydown", escape)
    }
  }, [id, open])
}
