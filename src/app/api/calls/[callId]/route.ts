import { NextResponse } from 'next/server';
import { db } from '@/db';
import { callSessions, receivers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { callId: string } }
) {
  try {
    const { callId } = params;

    const [session] = await db
      .select({
        id: callSessions.id,
        guestName: callSessions.guestName,
        targetReceiverId: callSessions.targetReceiverId,
        status: callSessions.status,
        createdAt: callSessions.createdAt,
        receiverName: receivers.displayName,
        receiverAvatar: receivers.avatarUrl,
      })
      .from(callSessions)
      .leftJoin(
        receivers,
        eq(callSessions.targetReceiverId, receivers.clerkUserId)
      )
      .where(eq(callSessions.id, callId));

    if (!session) {
      return NextResponse.json(
        { error: 'Call session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching call status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call session' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { callId: string } }
) {
  try {
    const { callId } = params;
    const body = await request.json().catch(() => ({}));
    const newStatus = body.status || 'ended';

    const [updated] = await db
      .update(callSessions)
      .set({
        status: newStatus,
        endedAt: new Date(),
      })
      .where(eq(callSessions.id, callId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating call status:', error);
    return NextResponse.json(
      { error: 'Failed to update call status' },
      { status: 500 }
    );
  }
}
