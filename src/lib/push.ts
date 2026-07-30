import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('Failed to set VAPID details:', err);
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  callId?: string;
  guestName?: string;
}

export async function sendWebPushNotification(
  subscription: any,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!subscription || !vapidPublicKey || !vapidPrivateKey) {
    console.warn('Web Push skipped: Missing subscription or VAPID credentials.');
    return false;
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: '/icon-192.png',
        data: {
          url: payload.url,
          callId: payload.callId,
        },
      })
    );
    return true;
  } catch (error) {
    console.error('Error delivering Web Push notification:', error);
    return false;
  }
}
