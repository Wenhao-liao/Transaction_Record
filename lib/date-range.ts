export function toDateText(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getCurrentWeekRange() {
  const today = new Date();
  const day = today.getDay() || 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    weekStart: toDateText(weekStart),
    weekEnd: toDateText(weekEnd)
  };
}
