import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { qrCodes, qrCodeReceivers, callSessions, receivers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || 'user_mock_receiver_123';

    // Ensure receiver record exists in Postgres
    const [existingReceiver] = await db
      .select()
      .from(receivers)
      .where(eq(receivers.clerkUserId, targetUserId));

    // Fetch assigned QR codes
    const assignedQrCodes = await db
      .select({
        id: qrCodes.id,
        label: qrCodes.label,
        createdAt: qrCodes.createdAt,
      })
      .from(qrCodeReceivers)
      .innerJoin(qrCodes, eq(qrCodeReceivers.qrCodeId, qrCodes.id))
      .where(eq(qrCodeReceivers.receiverId, targetUserId));

    // Fetch recent call history
    const recentCalls = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.targetReceiverId, targetUserId))
      .orderBy(desc(callSessions.createdAt))
      .limit(10);

    return NextResponse.json({
      receiver: existingReceiver || { clerkUserId: targetUserId, displayName: 'Host' },
      qrCodes: assignedQrCodes,
      recentCalls,
    });
  } catch (error) {
    console.error('Error fetching receiver dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
