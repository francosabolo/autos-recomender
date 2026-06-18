'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

export function AppInit() {
  const { loadPortals, loadBoards, loadToday } = useAppStore()

  useEffect(() => {
    Promise.all([loadPortals(), loadBoards(), loadToday()])
  }, [loadPortals, loadBoards, loadToday])

  return null
}
