import { NextResponse } from 'next/server';
import { db } from '@/db';
import { callSessions, receivers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendWebPushNotification } from '@/lib/push';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qrCodeId, targetReceiverId, guestName } = body;

    if (!targetReceiverId) {
      return NextResponse.json(
        { error: 'targetReceiverId is required' },
        { status: 400 }
      );
    }

    // Verify target receiver exists
    const [targetReceiver] = await db
      .select()
      .from(receivers)
      .where(eq(receivers.clerkUserId, targetReceiverId));

    if (!targetReceiver) {
      return NextResponse.json(
        { error: 'Target receiver not found' },
        { status: 404 }
      );
    }

    // Create call session
    const [callSession] = await db
      .insert(callSessions)
      .values({
        qrCodeId: qrCodeId || null,
        targetReceiverId,
        guestName: guestName || 'Guest Caller',
        status: 'pending',
      })
      .returning();

    // Trigger Web Push Notification asynchronously
    if (targetReceiver.pushSubscription) {
      const callUrl = `/call/${callSession.id}`;
      sendWebPushNotification(targetReceiver.pushSubscription, {
        title: 'Incoming Video Call',
        body: `${callSession.guestName} is calling you via QR Code scan.`,
        url: callUrl,
        callId: callSession.id,
        guestName: callSession.guestName,
      }).catch((err) => console.error('Background push error:', err));
    }

    return NextResponse.json({
      callId: callSession.id,
      status: callSession.status,
      targetReceiver: {
        displayName: targetReceiver.displayName,
        avatarUrl: targetReceiver.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error creating call session:', error);
    return NextResponse.json(
      { error: 'Failed to create call session' },
      { status: 500 }
    );
  }
}
