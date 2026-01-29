import { NextRequest, NextResponse } from 'next/server'
import type { RoomConfig } from '@/lib/game'

// In-memory storage for room configs (needed for Vercel serverless)
// This allows players to regenerate game state even if game state is lost
const roomConfigs = new Map<string, RoomConfig>()

export async function GET(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const config = roomConfigs.get(roomNumber)
    
    if (!config) {
      return NextResponse.json({ error: 'Room config not found' }, { status: 404 })
    }
    
    return NextResponse.json(config)
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
    
    // Validate room number matches
    if (config.roomNumber !== roomNumber) {
      return NextResponse.json({ error: 'Room number mismatch' }, { status: 400 })
    }
    
    roomConfigs.set(roomNumber, config)
    return NextResponse.json({ success: true, config })
  } catch (error) {
    console.error('Error saving room config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
