import { NextRequest, NextResponse } from 'next/server'
import type { RoomConfig } from '@/lib/game'
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
const roomConfigs = new Map<string, RoomConfig>()

export async function GET(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const redisClient = getRedis()
    
    // Try Redis first
    if (redisClient) {
      const configJson = await redisClient.get(`room:${roomNumber}`)
      if (configJson) {
        const config = JSON.parse(configJson) as RoomConfig
        return NextResponse.json(config)
      }
    } else {
      // Fallback to in-memory
      const config = roomConfigs.get(roomNumber)
      if (config) {
        return NextResponse.json(config)
      }
    }
    
    return NextResponse.json({ error: 'Room config not found' }, { status: 404 })
  } catch (error) {
    console.error('Error fetching room config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const config: RoomConfig = await request.json()
    const redisClient = getRedis()
    
    // Validate room number matches
    if (config.roomNumber !== roomNumber) {
      return NextResponse.json({ error: 'Room number mismatch' }, { status: 400 })
    }
    
    // Try Redis first
    if (redisClient) {
      await redisClient.set(`room:${roomNumber}`, JSON.stringify(config), 'EX', 86400) // Expire after 24 hours
    } else {
      // Fallback to in-memory
      roomConfigs.set(roomNumber, config)
    }
    
    return NextResponse.json({ success: true, config })
  } catch (error) {
    console.error('Error saving room config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
