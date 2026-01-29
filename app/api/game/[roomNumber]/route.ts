import { NextRequest, NextResponse } from 'next/server'
import type { GameStateV1 } from '@/lib/game'
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

export async function GET(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const redisClient = getRedis()
    
    // Try Redis first
    if (redisClient) {
      const stateJson = await redisClient.get(`game:${roomNumber}`)
      if (stateJson) {
        const state = JSON.parse(stateJson) as GameStateV1
        return NextResponse.json(state)
      }
    } else {
      // Fallback to in-memory
      const state = gameStates.get(roomNumber)
      if (state) {
        return NextResponse.json(state)
      }
    }
    
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  } catch (error) {
    console.error('Error fetching game state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const state: GameStateV1 = await request.json()
    const redisClient = getRedis()
    
    // Validate room number matches
    if (state.roomNumber !== roomNumber) {
      return NextResponse.json({ error: 'Room number mismatch' }, { status: 400 })
    }
    
    // Try Redis first
    if (redisClient) {
      await redisClient.set(`game:${roomNumber}`, JSON.stringify(state), 'EX', 86400) // Expire after 24 hours
    } else {
      // Fallback to in-memory
      gameStates.set(roomNumber, state)
    }
    
    return NextResponse.json({ success: true, state })
  } catch (error) {
    console.error('Error saving game state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const { playerName } = await request.json()
    const redisClient = getRedis()
    
    // Try Redis first
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
    
    // Mark player as claimed
    state.claimedByName[playerName] = true
    
    // Save back
    if (redisClient) {
      await redisClient.set(`game:${roomNumber}`, JSON.stringify(state), 'EX', 86400)
    } else {
      gameStates.set(roomNumber, state)
    }
    
    return NextResponse.json({ success: true, state })
  } catch (error) {
    console.error('Error updating claim:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
