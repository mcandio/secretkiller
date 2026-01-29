import { NextRequest, NextResponse } from 'next/server'
import type { GameStateV1 } from '@/lib/game'

// In-memory storage (lost on server restart, but fine for party games)
const gameStates = new Map<string, GameStateV1>()

export async function GET(
  request: NextRequest,
  { params }: { params: { roomNumber: string } }
) {
  try {
    const roomNumber = params.roomNumber
    const state = gameStates.get(roomNumber)
    
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    return NextResponse.json(state)
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
    
    // Validate room number matches
    if (state.roomNumber !== roomNumber) {
      return NextResponse.json({ error: 'Room number mismatch' }, { status: 400 })
    }
    
    gameStates.set(roomNumber, state)
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
    
    const state = gameStates.get(roomNumber)
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    // Mark player as claimed
    state.claimedByName[playerName] = true
    gameStates.set(roomNumber, state)
    
    return NextResponse.json({ success: true, state })
  } catch (error) {
    console.error('Error updating claim:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
