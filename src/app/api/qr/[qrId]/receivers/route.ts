import { NextResponse } from 'next/server';
import { db } from '@/db';
import { qrCodes, qrCodeReceivers, receivers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { qrId: string } }
) {
  try {
    const { qrId } = params;

    // Verify QR code existence
    const [qrCode] = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, qrId));

    if (!qrCode) {
      return NextResponse.json(
        { error: 'QR Code not found' },
        { status: 404 }
      );
    }

    // Fetch mapped receivers
    let mappedReceivers = await db
      .select({
        clerkUserId: receivers.clerkUserId,
        displayName: receivers.displayName,
        avatarUrl: receivers.avatarUrl,
      })
      .from(qrCodeReceivers)
      .innerJoin(
        receivers,
        eq(qrCodeReceivers.receiverId, receivers.clerkUserId)
      )
      .where(eq(qrCodeReceivers.qrCodeId, qrId));

    // Fallback: If no mapped receivers or only mock receiver, return all registered hosts
    if (mappedReceivers.length === 0) {
      mappedReceivers = await db
        .select({
          clerkUserId: receivers.clerkUserId,
          displayName: receivers.displayName,
          avatarUrl: receivers.avatarUrl,
        })
        .from(receivers);
    }

    return NextResponse.json({
      qrCode: {
        id: qrCode.id,
        label: qrCode.label,
      },
      receivers: mappedReceivers,
    });
  } catch (error) {
    console.error('Error fetching QR receivers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QR code receivers' },
      { status: 500 }
    );
  }
}
