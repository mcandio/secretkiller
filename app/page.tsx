'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadActiveGame, getClaimedPlayerName, type Assignment, type CurrentAssignment, loadGameFromServer, loadRoomConfigFromServer, generateGameFromConfig, saveGame, syncGameToServer, loadGameByRoom, eliminateTarget, normalizeName, getCurrentAssignment, getTimeUntilNextRoomChange, markPlayerAsDead, flushDatabase } from '@/lib/game'
import Navigation from '@/components/Navigation'
import RoomEntry from '@/components/RoomEntry'
import { useLanguage } from '@/contexts/LanguageContext'

function HomePageContent() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hasActiveGame, setHasActiveGame] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showRoomEntry, setShowRoomEntry] = useState(false)
  const [showMission, setShowMission] = useState(false)
  const [myMission, setMyMission] = useState<CurrentAssignment | null>(null)
  const [joiningRoom, setJoiningRoom] = useState(false)
  const [eliminating, setEliminating] = useState(false)
  const [eliminationMessage, setEliminationMessage] = useState<string | null>(null)
  const [timeUntilRoomChange, setTimeUntilRoomChange] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const game = loadActiveGame()
    setHasActiveGame(game !== null)
    
    // Check if there's a claimed player and load their mission
    if (game) {
      const claimedPlayerName = getClaimedPlayerName()
      if (claimedPlayerName) {
        const currentAssignment = getCurrentAssignment(game, claimedPlayerName)
        if (currentAssignment) {
          setMyMission(currentAssignment)
        }
        
        // Initialize time until next room change
        const timeUntil = getTimeUntilNextRoomChange(game)
        setTimeUntilRoomChange(timeUntil)
      }
    }

    // Poll for game state updates to reflect eliminations and room rotations
    const pollInterval = setInterval(async () => {
      const currentGame = loadActiveGame()
      if (currentGame) {
        const serverState = await loadGameFromServer(currentGame.roomNumber)
        if (serverState) {
          saveGame(serverState)
          const claimedPlayerName = getClaimedPlayerName()
          if (claimedPlayerName) {
            // Get current assignment with rotating room
            const currentAssignment = getCurrentAssignment(serverState, claimedPlayerName)
            if (currentAssignment) {
              setMyMission(currentAssignment)
              setHasActiveGame(true)
            }
            
            // Update time until next room change
            const timeUntil = getTimeUntilNextRoomChange(serverState)
            setTimeUntilRoomChange(timeUntil)
          }
        }
      }
    }, 1000) // Poll every second for smoother timer updates

    // Check for room parameter in URL and auto-join
    if (typeof window !== 'undefined' && !game && !joiningRoom) {
      const roomParam = searchParams.get('room')
      if (roomParam && roomParam.length >= 4) {
        handleAutoJoinRoom(roomParam)
      }
    }

    return () => clearInterval(pollInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleAutoJoinRoom = async (roomNumber: string) => {
    setJoiningRoom(true)
    try {
      // Try to load game state from server first
      let gameState = await loadGameFromServer(roomNumber)
      
      // If game state not found, try to load room config and regenerate
      if (!gameState) {
        const roomConfig = await loadRoomConfigFromServer(roomNumber)
        
        if (roomConfig) {
          // Regenerate game state deterministically from room config
          gameState = generateGameFromConfig(roomConfig, roomNumber)
          
          // Sync regenerated game state to server
          await syncGameToServer(gameState)
        } else {
          // Try local generation as fallback
          gameState = loadGameByRoom(roomNumber)
          if (gameState) {
            // Sync local game to server
            await syncGameToServer(gameState)
          }
        }
      }
      
      if (gameState) {
        // Save as active game
        saveGame(gameState)
        setHasActiveGame(true)
        
        // Remove room parameter from URL
        router.replace('/')
        
        // Redirect to kiosk
        router.push('/kiosk')
      }
    } catch (err) {
      console.error('Error auto-joining room:', err)
    } finally {
      setJoiningRoom(false)
    }
  }

  const handleEliminateTarget = async () => {
    const game = loadActiveGame()
    if (!game || !myMission) return

    const claimedPlayerName = getClaimedPlayerName()
    if (!claimedPlayerName) return

    setEliminating(true)
    setEliminationMessage(null)

    try {
      const targetNameNormalized = normalizeName(myMission.targetName)
      const updatedState = await eliminateTarget(claimedPlayerName, targetNameNormalized)
      
      if (updatedState) {
        // Update local mission with current room
        const currentAssignment = getCurrentAssignment(updatedState, claimedPlayerName)
        if (currentAssignment) {
          setMyMission(currentAssignment)
          setEliminationMessage(t.instructions.eliminationSuccess)
          setTimeout(() => setEliminationMessage(null), 5000)
        }
      } else {
        setEliminationMessage(t.instructions.eliminationError)
        setTimeout(() => setEliminationMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error eliminating target:', err)
      setEliminationMessage(t.instructions.eliminationError)
      setTimeout(() => setEliminationMessage(null), 5000)
    } finally {
      setEliminating(false)
    }
  }

  const handleMarkAsDead = async () => {
    const game = loadActiveGame()
    if (!game) return

    const claimedPlayerName = getClaimedPlayerName()
    if (!claimedPlayerName) return

    if (!confirm('Are you sure you want to mark yourself as dead?')) {
      return
    }

    try {
      const updatedState = await markPlayerAsDead(claimedPlayerName)
      if (updatedState) {
        setEliminationMessage(t.instructions.markedAsDead)
        setTimeout(() => setEliminationMessage(null), 5000)
        // Clear mission since player is dead
        setMyMission(null)
      }
    } catch (err) {
      console.error('Error marking as dead:', err)
      setEliminationMessage('Error marking as dead')
      setTimeout(() => setEliminationMessage(null), 5000)
    }
  }

  const handleFlushDatabase = () => {
    if (confirm(t.instructions.flushConfirm)) {
      flushDatabase()
      setHasActiveGame(false)
      setMyMission(null)
      setEliminationMessage(t.instructions.flushSuccess)
      setTimeout(() => {
        setEliminationMessage(null)
        window.location.reload()
      }, 2000)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col">
      <Navigation />
      
      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-4 flex-shrink-0">
        <h1 className="text-3xl md:text-4xl font-bold text-center">
          {t.instructions.title}
        </h1>
        <p className="text-lg md:text-xl text-center mt-1 opacity-90">
          {t.instructions.subtitle}
        </p>
      </div>

      {/* Instructions Grid - fits iPad Pro 11 screen */}
      <div className="flex-1 overflow-hidden p-3 md:p-4">
        {/* Timer for room change - show at top if active */}
        {mounted && hasActiveGame && myMission && timeUntilRoomChange !== null && timeUntilRoomChange > 0 && (
          <div className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-3 mb-3 text-center shadow-lg">
            <p className="text-xl md:text-2xl font-bold text-yellow-900">
              ⏱️ {t.instructions.roomChangeIn} {Math.ceil(timeUntilRoomChange / 1000)} {t.instructions.seconds}
            </p>
          </div>
        )}
        <div className="h-full grid grid-cols-2 grid-rows-3 gap-2 md:gap-3">
          {/* Objective */}
          <div className="bg-white border-[3px] border-blue-600 rounded-lg p-3 md:p-4 flex flex-col shadow-lg overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-blue-900 flex-shrink-0">🎯 {t.instructions.objective}</h2>
            <p className="text-base md:text-lg leading-tight text-gray-900 flex-1 overflow-y-auto">
              {t.instructions.objectiveText}
            </p>
          </div>

          {/* What You Receive */}
          <div className="bg-yellow-50 border-[3px] border-yellow-600 rounded-lg p-3 md:p-4 flex flex-col shadow-lg overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-yellow-900 flex-shrink-0">📋 {t.instructions.whatYouReceive}</h2>
            <ul className="text-base md:text-lg leading-tight text-gray-900 space-y-1 flex-1 overflow-y-auto">
              {t.instructions.whatYouReceiveItems.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
            <p className="text-sm md:text-base font-bold text-red-700 mt-2 flex-shrink-0">
              ⚠️ {t.instructions.keepSecret}
            </p>
          </div>

          {/* How to Eliminate */}
          <div className="bg-green-50 border-[3px] border-green-600 rounded-lg p-3 md:p-4 flex flex-col shadow-lg overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-green-900 flex-shrink-0">⚔️ {t.instructions.howToEliminate}</h2>
            <div className="flex-1 overflow-y-auto">
              <p className="text-base md:text-lg leading-tight text-gray-900 mb-2">
                {t.instructions.whenTarget}
              </p>
              <ul className="text-base md:text-lg leading-tight text-gray-900 space-y-1 mb-2">
                {t.instructions.eliminateItems.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
              <p className="text-base md:text-lg font-bold text-red-700">
                {t.instructions.sayDead}
              </p>
            </div>
          </div>

          {/* When Eliminated */}
          <div className="bg-purple-50 border-[3px] border-purple-600 rounded-lg p-3 md:p-4 flex flex-col shadow-lg overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-purple-900 flex-shrink-0">💀 {t.instructions.whenEliminated}</h2>
            <ul className="text-base md:text-lg leading-tight text-gray-900 space-y-1 flex-1 overflow-y-auto">
              {t.instructions.eliminatedItems.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>

          {/* Rules */}
          <div className="bg-indigo-50 border-[3px] border-indigo-600 rounded-lg p-3 md:p-4 flex flex-col shadow-lg overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-indigo-900 flex-shrink-0">📜 {t.instructions.rules}</h2>
            <ul className="text-base md:text-lg leading-tight text-gray-900 space-y-1 flex-1 overflow-y-auto">
              {t.instructions.rulesItems.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>

          {/* Final Warning */}
          <div className="bg-red-100 border-[4px] border-red-700 rounded-lg p-3 md:p-4 flex flex-col shadow-lg overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-red-900 flex-shrink-0">⚠️ {t.instructions.finalWarning}</h2>
            <div className="flex-1 overflow-y-auto">
              <p className="text-2xl md:text-3xl font-bold text-red-900 mb-2">
                {t.instructions.trustNoOne}
              </p>
              <p className="text-base md:text-lg leading-tight text-red-800">
                {t.instructions.beSuspicious}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with CTA */}
      <div className="bg-gray-800 px-6 py-4 flex-shrink-0">
        {mounted && hasActiveGame ? (
          <div className="space-y-3">
            {eliminationMessage && (
              <div className={`text-center text-lg font-semibold py-2 px-4 rounded-lg ${
                eliminationMessage.includes('Error') || eliminationMessage.includes('Error')
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {eliminationMessage}
              </div>
            )}
            {myMission && (
              <>
                <button
                  onClick={() => setShowMission(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-center text-2xl md:text-3xl font-bold py-4 px-8 rounded-lg transition-colors shadow-lg"
                >
                  {t.instructions.viewMyMission}
                </button>
                <button
                  onClick={handleEliminateTarget}
                  disabled={eliminating}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-center text-xl md:text-2xl font-bold py-3 px-8 rounded-lg transition-colors shadow-lg"
                >
                  {eliminating ? '...' : t.instructions.eliminateTarget}
                </button>
                <button
                  onClick={handleMarkAsDead}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white text-center text-xl md:text-2xl font-bold py-3 px-8 rounded-lg transition-colors shadow-lg"
                >
                  💀 {t.instructions.imDead}
                </button>
              </>
            )}
            <Link
              href="/kiosk"
              className="block w-full bg-green-600 hover:bg-green-700 text-white text-center text-2xl md:text-3xl font-bold py-4 px-8 rounded-lg transition-colors shadow-lg"
            >
              {t.instructions.startKiosk}
            </Link>
          </div>
        ) : mounted ? (
          <div className="text-center space-y-3">
            <button
              onClick={() => {
                if (confirm(t.instructions.clearCacheBeforeJoin)) {
                  flushDatabase()
                }
                setShowRoomEntry(true)
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xl font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg mb-2"
            >
              {t.instructions.joinRoom}
            </button>
            <button
              onClick={handleFlushDatabase}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors shadow-lg"
            >
              {t.instructions.flushDatabase}
            </button>
            <p className="text-lg md:text-xl text-white">
              or
            </p>
            <Link
              href="/host"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
            >
              {t.instructions.createGame}
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg md:text-xl text-white">Loading...</p>
          </div>
        )}
      </div>

      {/* Mission View Modal */}
      {showMission && myMission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-lg p-8 md:p-12 max-w-2xl w-full text-center space-y-8 relative">
            <button
              onClick={() => setShowMission(false)}
              className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
            >
              ×
            </button>
            
            <div className="bg-yellow-400 text-red-900 p-6 rounded-lg mb-8">
              <p className="text-3xl md:text-4xl font-bold">
                ⚠️ {t.kiosk.doNotSay}
              </p>
            </div>

            {timeUntilRoomChange !== null && timeUntilRoomChange > 0 && (
              <div className="bg-yellow-300 border-2 border-yellow-600 rounded-lg p-4 mb-4">
                <p className="text-xl md:text-2xl font-bold text-yellow-900">
                  {t.instructions.roomChangeIn} {Math.ceil(timeUntilRoomChange / 1000)} {t.instructions.seconds}
                </p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <p className="text-2xl md:text-3xl text-red-200 mb-2">{t.kiosk.yourTarget}</p>
                <p className="text-5xl md:text-7xl font-bold">{myMission.targetName}</p>
              </div>

              <div>
                <p className="text-2xl md:text-3xl text-red-200 mb-2">{t.kiosk.room}</p>
                <p className="text-4xl md:text-6xl font-bold">{myMission.room}</p>
              </div>

              <div>
                <p className="text-2xl md:text-3xl text-red-200 mb-2">{t.kiosk.object}</p>
                <p className="text-4xl md:text-6xl font-bold">{myMission.object}</p>
              </div>
            </div>

            <button
              onClick={() => setShowMission(false)}
              className="w-full bg-white text-red-600 text-2xl md:text-3xl font-bold py-6 px-8 rounded-lg hover:bg-gray-100 transition-colors mt-8"
            >
              {t.kiosk.memorized}
            </button>
          </div>
        </div>
      )}

      {/* Room Entry Modal */}
      {showRoomEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <button
              onClick={() => setShowRoomEntry(false)}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700"
            >
              ×
            </button>
            <RoomEntry />
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  )
}
