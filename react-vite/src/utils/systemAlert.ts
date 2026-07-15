export async function showSystemAlert(
  title: string,
  message: string,
  detail?: string,
): Promise<void> {
  try {
    if (window.desktop?.showNotification) {
      const result = await window.desktop.showNotification({ title, message, detail });
      if (result?.ok !== false) return;
    }
  } catch {
    // fall through
  }

  try {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: detail ? `${message}\n${detail}` : message });
        return;
      }
      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body: detail ? `${message}\n${detail}` : message });
          return;
        }
      }
    }
  } catch {
    // ignore
  }
}
