'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function publishVideo(id: string) {
  const supabase = createAdminClient()
  await supabase.from('growth_bible_videos').update({ is_published: true }).eq('id', id)
  revalidatePath('/content')
}

export async function unpublishVideo(id: string) {
  const supabase = createAdminClient()
  await supabase.from('growth_bible_videos').update({ is_published: false }).eq('id', id)
  revalidatePath('/content')
}

export async function deleteVideo(id: string) {
  const supabase = createAdminClient()
  await supabase.from('growth_bible_videos').delete().eq('id', id)
  revalidatePath('/content')
}

export async function addVideo(title: string, muxPlaybackId: string, durationSeconds: number) {
  const supabase = createAdminClient()
  await supabase.from('growth_bible_videos').insert({
    title,
    mux_playback_id: muxPlaybackId || null,
    duration_seconds: durationSeconds || null,
    is_published: false,
  })
  revalidatePath('/content')
}

export async function createPlaylist(name: string, videoIds: string[]) {
  const supabase = createAdminClient()
  await supabase.from('playlists').insert({ name, video_ids: videoIds })
  revalidatePath('/content')
}

export async function createAbTest(videoId: string, variantATitle: string, variantBTitle: string) {
  const supabase = createAdminClient()
  await supabase.from('content_ab_tests').insert({
    video_id: videoId,
    variant_a_title: variantATitle,
    variant_b_title: variantBTitle,
  })
  revalidatePath('/content')
}

export async function endAbTest(id: string) {
  const supabase = createAdminClient()
  const { data: test } = await supabase
    .from('content_ab_tests')
    .select('*')
    .eq('id', id)
    .single()

  if (!test) return

  await supabase.from('content_ab_tests').update({ status: 'completed' }).eq('id', id)

  if (test.video_id) {
    const winningTitle =
      test.variant_a_views >= test.variant_b_views
        ? test.variant_a_title
        : test.variant_b_title
    await supabase
      .from('growth_bible_videos')
      .update({ title: winningTitle })
      .eq('id', test.video_id)
  }

  revalidatePath('/content')
}
