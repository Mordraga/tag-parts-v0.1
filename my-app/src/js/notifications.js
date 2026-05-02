import { LocalNotifications } from '@capacitor/local-notifications';

const BASE_ID = 1001;
const SLOT_HOURS = { morning: 9, afternoon: 14, evening: 19 };

export async function requestPermission() {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch {
    return false;
  }
}

export async function cancelReminders() {
  try {
    const { notifications: pending } = await LocalNotifications.getPending();
    if (pending.length) await LocalNotifications.cancel({ notifications: pending });
  } catch {
    // not on native — ignore
  }
}

export async function scheduleReminders(slots) {
  await cancelReminders();
  if (!slots.length) return;
  const notifications = slots.map((slot, i) => ({
    id: BASE_ID + i,
    title: 'Tag Parts',
    body: "Time to check in — who's fronting?",
    schedule: { on: { hour: SLOT_HOURS[slot], minute: 0 }, repeats: true, allowWhileIdle: true },
    smallIcon: 'ic_stat_icon_config_sample',
  }));
  try {
    await LocalNotifications.schedule({ notifications });
  } catch {
    // not on native — ignore
  }
}

export async function initReminders() {
  if (localStorage.getItem('reminder_enabled') !== 'true') return;
  const slots = JSON.parse(localStorage.getItem('reminder_slots') || '[]');
  await scheduleReminders(slots);
}
