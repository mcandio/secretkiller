'use client'

import Link from 'next/link'
import { loadActiveGame } from '@/lib/game'

export default function HomePage() {
  const hasActiveGame = typeof window !== 'undefined' && loadActiveGame() !== null

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-8">
          THE SECRET ASSASSIN GAME
        </h1>
        <p className="text-xl md:text-2xl text-center text-gray-600 mb-12">
          (Chaotic but Chill)
        </p>

        <div className="space-y-6 text-lg md:text-xl leading-relaxed">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Objective</h2>
            <p>
              Each player has a secret mission. Your goal is to eliminate your assigned target by naturally persuading them to enter a specific room while holding a specific object.
            </p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">What You Receive</h2>
            <p>You will secretly receive:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>One target (another guest)</li>
              <li>One room</li>
              <li>One object</li>
            </ul>
            <p className="mt-4 font-semibold text-red-600">
              This information is private. Do not show it to anyone.
            </p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">How to Eliminate Someone</h2>
            <p>If your target:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Enters the assigned room</li>
              <li>While holding the assigned object</li>
            </ul>
            <p className="mt-4">
              You may clearly say: <span className="font-bold text-red-600">"You're dead."</span>
            </p>
            <p className="mt-2">At that moment, the elimination is valid.</p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">What Happens When You're Eliminated</h2>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>You are out of the game.</li>
              <li>You must stop trying to manipulate other players.</li>
              <li>You may not reveal who killed you or what your mission was.</li>
              <li>The player who eliminated you inherits your mission and continues playing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">End of the Game</h2>
            <p>The game ends when:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Only one player remains alive, or</li>
              <li>The host decides to end the game.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Rules</h2>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>No physical force.</li>
              <li>Do not say "this is for the game".</li>
              <li>Do not threaten or pressure anyone.</li>
              <li>Do not show messages, screens, or notes.</li>
              <li>Everything must feel casual and natural.</li>
            </ul>
          </section>

          <section className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-red-700">Final Warning</h2>
            <p className="text-xl md:text-2xl font-semibold text-red-800">
              Trust no one.
            </p>
            <p className="mt-2 text-lg">
              If someone asks you to grab something or go somewhere, be suspicious.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          {hasActiveGame ? (
            <Link
              href="/kiosk"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center text-2xl md:text-3xl font-bold py-6 px-8 rounded-lg transition-colors"
            >
              Start Kiosk Mode
            </Link>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-xl text-gray-600">
                Host needs to create a game first.
              </p>
              <Link
                href="/host"
                className="inline-block bg-gray-600 hover:bg-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors"
              >
                Go to Host Setup
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
