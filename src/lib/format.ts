// Display formatting helpers. Pure so they're easy to test; no Intl so the
// output is identical on Hermes/Android/iOS regardless of device locale.

// 45 -> "GHS 45.00", 1250 -> "GHS 1,250.00".
export function formatGhs(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100).toString();
  const fraction = (cents % 100).toString().padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = amount < 0 && cents > 0 ? "-" : "";
  return `GHS ${sign}${grouped}.${fraction}`;
}

// 18 -> "18 mins", 1 -> "1 min".
export function formatEta(minutes: number): string {
  return `${minutes} ${minutes === 1 ? "min" : "mins"}`;
}

// Morning 05:00-11:59, afternoon 12:00-16:59, evening otherwise.
export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

// "  Ama Serwaa Mensah " -> "Ama", blank -> "".
export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// "James Mensah" -> "JM", "James" -> "J", blank -> "".
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
