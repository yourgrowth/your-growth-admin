import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_SUBJECT_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5000

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, subject, description } = body

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    }

    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json({ error: 'subject too long' }, { status: 400 })
    }

    if (description && typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: 'description too long' }, { status: 400 })
    }

    // Validate user_id if provided — must be a UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const safeUserId =
      user_id && typeof user_id === 'string' && UUID_REGEX.test(user_id) ? user_id : null

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: safeUserId,
        subject: subject.trim(),
        description: typeof description === 'string' ? description.trim() : null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
