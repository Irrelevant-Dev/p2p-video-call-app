import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { qrCodes, qrCodeReceivers, callSessions, receivers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    const targetUserId = userId || 'user_mock_receiver_123';
    const email = user?.emailAddresses[0]?.emailAddress || 'host@example.com';
    const displayName =
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || email.split('@')[0] || 'Front Desk Host';
    const avatarUrl = user?.imageUrl || 'https://images.clerk.dev/static/default-user-avatar.svg';

    // 1. Upsert receiver into Postgres
    const [existingReceiver] = await db
      .insert(receivers)
      .values({
        clerkUserId: targetUserId,
        email,
        displayName,
        avatarUrl,
      })
      .onConflictDoUpdate({
        target: receivers.clerkUserId,
        set: { displayName, avatarUrl, email },
      })
      .returning();

    // 2. Fetch all QR codes in system
    let allQrCodes = await db.select().from(qrCodes);

    // If no QR code exists, seed a default station
    if (allQrCodes.length === 0) {
      const [defaultQr] = await db
        .insert(qrCodes)
        .values({ label: 'Main Entrance Lobby Kiosk' })
        .returning();
      allQrCodes = [defaultQr];
    }

    // 3. Auto-link user to all QR codes
    for (const qr of allQrCodes) {
      await db
        .insert(qrCodeReceivers)
        .values({
          qrCodeId: qr.id,
          receiverId: targetUserId,
        })
        .onConflictDoNothing();
    }

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
      receiver: existingReceiver,
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
