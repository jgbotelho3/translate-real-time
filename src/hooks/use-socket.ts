'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

type Namespace = '/speaker' | '/listener'

export function useSocket(namespace: Namespace) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const socket = io(namespace, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [namespace])

  return { socket: socketRef.current, isConnected, socketRef }
}
