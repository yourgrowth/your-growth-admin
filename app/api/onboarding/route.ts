import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_STEP_LENGTH = 100
const MAX_SECONDS = 86400

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, step, completed, skipped, time_spent_seconds } = body

    if (!step || typeof step !== 'string' || step.length > MAX_STEP_LENGTH) {
      return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }

    // Validate user_id if provided — must be a UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const safeUserId =
      user_id && typeof user_id === 'string' && UUID_REGEX.test(user_id) ? user_id : null

    const safeSeconds =
      typeof time_spent_seconds === 'number' && time_spent_seconds >= 0
        ? Math.min(time_spent_seconds, MAX_SECONDS)
        : null

    const supabase = await createClient()
    const { error } = await supabase.from('onboarding_events').insert({
      user_id: safeUserId,
      step: step.trim(),
      completed: completed === true,
      skipped: skipped === true,
      time_spent_seconds: safeSeconds,
    })

    if (error) {
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
