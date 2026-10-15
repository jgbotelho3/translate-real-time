'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'audio-input-device-id'

// Lists the machine's audio inputs (mic, USB interface from the mixing console…)
// and remembers the chosen one. `deviceId` is undefined for the system default.
export function useAudioInputs() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selected, setSelected] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })

  const refresh = useCallback(async () => {
    const all = await navigator.mediaDevices?.enumerateDevices()
    setDevices((all ?? []).filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default'))
  }, [])

  // Labels stay empty until mic permission is granted — ask once, then re-list.
  const detect = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      // permission denied — list stays unlabeled
    }
    await refresh()
  }, [refresh])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial device list
    refresh()
    navigator.mediaDevices?.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh)
  }, [refresh])

  const setDeviceId = useCallback((id: string) => {
    setSelected(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // storage unavailable — selection just isn't remembered
    }
  }, [])

  // A saved device that's no longer plugged in falls back to the system default.
  const deviceId = devices.some((d) => d.deviceId === selected) ? selected : undefined
  const hasLabels = devices.some((d) => d.label)

  return { devices, deviceId, setDeviceId, detect, hasLabels }
}

export type AudioInputs = ReturnType<typeof useAudioInputs>
