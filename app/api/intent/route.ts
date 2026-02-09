import { NextRequest, NextResponse } from 'next/server'
import { classifyIntentLocal, classifyIntentWithAI, expandQuery } from '@/lib/nlp/intent'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const useAI = searchParams.get('ai') === 'true'

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const intent = useAI
      ? await classifyIntentWithAI(query)
      : classifyIntentLocal(query)

    const expansions = expandQuery(query)

    return NextResponse.json({
      query,
      intent,
      expansions,
    })
  } catch (error) {
    console.error('Intent classification error:', error)

    return NextResponse.json(
      { error: 'Intent classification failed' },
      { status: 500 }
    )
  }
}
