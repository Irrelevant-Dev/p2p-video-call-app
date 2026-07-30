import { db } from './index';
import { qrCodes, receivers, qrCodeReceivers } from './schema';

async function seed() {
  console.log('Seeding database with initial QR codes and receivers...');

  // Create a default receiver (mock Clerk user ID for testing)
  const mockReceiverId = 'user_mock_receiver_123';
  await db
    .insert(receivers)
    .values({
      clerkUserId: mockReceiverId,
      email: 'host@example.com',
      displayName: 'Front Desk Host',
      avatarUrl: 'https://images.clerk.dev/static/default-user-avatar.svg',
    })
    .onConflictDoNothing();

  // Create a default QR Code
  const [qrCode] = await db
    .insert(qrCodes)
    .values({
      label: 'Main Entrance Lobby Kiosk',
    })
    .returning();

  console.log(`Created QR Code with ID: ${qrCode.id}`);

  // Link QR code to receiver
  await db
    .insert(qrCodeReceivers)
    .values({
      qrCodeId: qrCode.id,
      receiverId: mockReceiverId,
    })
    .onConflictDoNothing();

  console.log('Database seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
