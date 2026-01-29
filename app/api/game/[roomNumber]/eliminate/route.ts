import { NextRequest, NextResponse } from 'next/server'
import type { GameStateV1 } from '@/lib/game'
import { normalizeName } from '@/lib/game'
// @ts-ignore - ioredis types will be available after npm install
import Redis from 'ioredis'

// Redis client - reuse connection
let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.log('REDIS_URL not set, using in-memory storage')
    return null
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
    })
    return redis
  } catch (e) {
    console.error('Failed to connect to Redis:', e)
    return null
  }
}

// Fallback in-memory storage (only works for single instance, not Vercel production)
const gameStates = new Map<string, GameStateV1>()

export async function POST(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const { killerNameNormalized, targetNameNormalized } = await request.json()
    const redisClient = getRedis()
    
    // Load current game state
    let state: GameStateV1 | null = null
    if (redisClient) {
      const stateJson = await redisClient.get(`game:${roomNumber}`)
      if (stateJson) {
        state = JSON.parse(stateJson) as GameStateV1
      }
    } else {
      state = gameStates.get(roomNumber) || null
    }
    
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Ensure eliminations field exists (for backward compatibility)
    if (!state.eliminations) {
      state.eliminations = {}
    }

    // Check if killer exists and has a mission
    const killerAssignment = state.assignmentsByName[killerNameNormalized]
    if (!killerAssignment) {
      return NextResponse.json({ error: 'Killer not found in game' }, { status: 400 })
    }

    // Check if target exists and has a mission
    const targetAssignment = state.assignmentsByName[targetNameNormalized]
    if (!targetAssignment) {
      return NextResponse.json({ error: 'Target not found in game' }, { status: 400 })
    }

    // Check if this is a self-reported death (starts with "dead_")
    const isSelfReportedDeath = killerNameNormalized.startsWith('dead_')
    
    if (!isSelfReportedDeath) {
      // Verify that the target is actually the killer's target
      const killerTargetNormalized = normalizeName(killerAssignment.targetName)
      if (killerTargetNormalized !== targetNameNormalized) {
        return NextResponse.json({ error: 'Target is not the killer\'s assigned target' }, { status: 400 })
      }
    }

    // Check if target was already eliminated
    const alreadyEliminated = Object.values(state.eliminations).includes(targetNameNormalized)
    if (alreadyEliminated) {
      return NextResponse.json({ error: 'Target already eliminated' }, { status: 400 })
    }

    // Record the elimination
    state.eliminations[killerNameNormalized] = targetNameNormalized

    // Only inherit mission if not self-reported death
    if (!isSelfReportedDeath) {
      // Inherit the target's mission
      // The killer's new target becomes the eliminated target's target
      state.assignmentsByName[killerNameNormalized] = {
        targetName: targetAssignment.targetName,
        room: targetAssignment.room,
        object: targetAssignment.object,
      }
    }

    // Save back
    if (redisClient) {
      await redisClient.set(`game:${roomNumber}`, JSON.stringify(state), 'EX', 86400)
    } else {
      gameStates.set(roomNumber, state)
    }
    
    return NextResponse.json({ success: true, state })
  } catch (error) {
    console.error('Error processing elimination:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
