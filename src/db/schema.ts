import { pgTable, text, timestamp, uuid, pgEnum, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const callStatusEnum = pgEnum('call_status', [
  'pending',
  'ringing',
  'active',
  'ended',
  'declined',
  'missed',
]);

export const receivers = pgTable('receivers', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  pushSubscription: jsonb('push_subscription'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const qrCodes = pgTable('qr_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const qrCodeReceivers = pgTable(
  'qr_code_receivers',
  {
    qrCodeId: uuid('qr_code_id')
      .references(() => qrCodes.id, { onDelete: 'cascade' })
      .notNull(),
    receiverId: text('receiver_id')
      .references(() => receivers.clerkUserId, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.qrCodeId, t.receiverId] }),
  })
);

export const callSessions = pgTable('call_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
  guestName: text('guest_name').default('Guest Caller').notNull(),
  targetReceiverId: text('target_receiver_id')
    .references(() => receivers.clerkUserId)
    .notNull(),
  status: callStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
});
