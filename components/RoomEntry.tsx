'use client'

import { useState, useEffect } from 'react'
import { 
  loadGameByRoom, 
  loadGameFromServer, 
  loadRoomConfigFromServer,
  generateGameFromConfig,
  saveGame, 
  syncGameToServer 
} from '@/lib/game'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

interface RoomEntryProps {
  onJoin?: () => void
  initialRoomNumber?: string
}

export default function RoomEntry({ onJoin, initialRoomNumber }: RoomEntryProps) {
  const { t } = useLanguage()
  const [roomNumber, setRoomNumber] = useState(initialRoomNumber || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for room number in URL on client side
    if (typeof window !== 'undefined' && !initialRoomNumber) {
      const params = new URLSearchParams(window.location.search)
      const roomParam = params.get('room')
      if (roomParam) {
        setRoomNumber(roomParam)
        handleJoinRoom(roomParam)
      }
    }
  }, [])

  const handleJoinRoom = async (roomNum?: string) => {
    setError('')
    setLoading(true)

    const trimmed = (roomNum || roomNumber).trim()
    if (!trimmed || trimmed.length < 4) {
      setError(t.roomEntry.invalidRoom)
      setLoading(false)
      return
    }

    try {
      // Try to load game state from server first
      let gameState = await loadGameFromServer(trimmed)
      
      // If game state not found, try to load room config and regenerate
      if (!gameState) {
        const roomConfig = await loadRoomConfigFromServer(trimmed)
        
        if (roomConfig) {
          // Regenerate game state deterministically from room config
          gameState = generateGameFromConfig(roomConfig, trimmed)
          
          // Sync regenerated game state to server
          await syncGameToServer(gameState)
        } else {
          // Try local generation as fallback
          gameState = loadGameByRoom(trimmed)
          if (gameState) {
            // Sync local game to server
            await syncGameToServer(gameState)
          }
        }
      }
      
      if (!gameState) {
        setError(t.roomEntry.roomNotFound)
        setLoading(false)
        return
      }

      // Save as active game
      saveGame(gameState)
      
      // Call onJoin callback if provided
      if (onJoin) {
        onJoin()
      }
      
      // Navigate to kiosk
      router.push('/kiosk')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 max-w-md w-full">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">{t.roomEntry.title}</h2>
      <p className="text-gray-600 mb-6 text-center">
        {t.roomEntry.description}
      </p>
      
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={roomNumber}
        onChange={(e) => {
          setRoomNumber(e.target.value.replace(/\D/g, ''))
          setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && roomNumber.length >= 4 && !loading) {
            handleJoinRoom()
          }
        }}
        className="w-full text-3xl text-center p-4 border-2 border-gray-300 rounded-lg mb-4 font-mono"
        placeholder="0000"
        autoFocus
      />
      
      {error && (
        <p className="text-red-600 text-center mb-4">{error}</p>
      )}
      
      <button
        onClick={() => handleJoinRoom()}
        disabled={roomNumber.length < 4 || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xl font-bold py-4 px-6 rounded-lg transition-colors"
      >
        {loading ? t.roomEntry.joining : t.roomEntry.joinRoom}
      </button>
    </div>
  )
}
