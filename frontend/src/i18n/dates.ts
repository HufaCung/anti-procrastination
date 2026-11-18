import { daysBetween, parseDay, fmt, fmtMinutes, fmtMinutesPadded, fmtSlot, relDay, relDue, greeting } from '../logic/dates';
import type { Language } from './LanguageContext';

const english = { fmt, fmtMinutes, fmtMinutesPadded, fmtSlot, relDay, relDue, greeting };
const vietnameseDate = (options: Intl.DateTimeFormatOptions) => {
  const formatter = new Intl.DateTimeFormat('vi-VN', options);
  return (date: Date) => formatter.format(date);
};
const vietnameseFormat: typeof fmt = {
  time: fmt.time,
  monthDay: vietnameseDate({ month: 'numeric', day: 'numeric' }),
  monthShort: vietnameseDate({ month: 'short' }),
  monthLong: vietnameseDate({ month: 'long' }),
  monthYear: vietnameseDate({ month: 'long', year: 'numeric' }),
  dow: vietnameseDate({ weekday: 'short' }),
  dowLong: vietnameseDate({ weekday: 'long' }),
  dowMonthDay: vietnameseDate({ weekday: 'short', month: 'numeric', day: 'numeric' }),
  longDate: vietnameseDate({ weekday: 'long', month: 'long', day: 'numeric' }),
};

function relativeDay(date: Date, now: Date): string {
  const days = daysBetween(now, date);
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  if (days === -1) return 'Hôm qua';
  return days > 1 && days < 7 ? vietnameseFormat.dow(date) : vietnameseFormat.monthDay(date);
}

const vietnamese: typeof english = {
  fmt: vietnameseFormat,
  relDay: relativeDay,
  relDue(due, now) {
    const date = parseDay(due);
    const days = daysBetween(now, date);
    if (days > 1) return `Còn ${days} ngày`;
    if (days < -1) return `${-days} ngày trước`;
    return relativeDay(date, now);
  },
  fmtSlot(date, now, withTime = true) {
    const days = daysBetween(now, date);
    const near = Math.abs(days) <= 1;
    const label = near ? relativeDay(date, now) : vietnameseFormat.dowMonthDay(date);
    return withTime ? `${label}${near ? ' ' : ' · '}${fmt.time(date)}` : label;
  },
  fmtMinutes: (minutes) => fmtMinutes(minutes).replace('h', ' giờ').replace('m', ' phút'),
  fmtMinutesPadded: (minutes) => fmtMinutesPadded(minutes).replace('h', ' giờ').replace('m', ' phút'),
  greeting(now) {
    const hour = now.getHours();
    if (hour >= 5 && hour < 12) return 'Chào buổi sáng';
    return hour >= 12 && hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  },
};

export function dateCopy(language: Language) {
  return language === 'vi' ? vietnamese : english;
}
