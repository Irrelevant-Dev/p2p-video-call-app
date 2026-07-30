import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { receivers } from '@/db/schema';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription data required' },
        { status: 400 }
      );
    }

    const email = user.emailAddresses[0]?.emailAddress || '';
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || email || 'Host';
    const avatarUrl = user.imageUrl || null;

    // Upsert receiver record with updated push subscription
    await db
      .insert(receivers)
      .values({
        clerkUserId: userId,
        email,
        displayName,
        avatarUrl,
        pushSubscription: subscription,
      })
      .onConflictDoUpdate({
        target: receivers.clerkUserId,
        set: {
          pushSubscription: subscription,
          displayName,
          avatarUrl,
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}
