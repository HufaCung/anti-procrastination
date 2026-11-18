import type { Project, Risk } from '../data/types';
import type { RiskReason } from '../logic/progress';
import type { Language } from './LanguageContext';

const labels = {
  en: { on_track: 'On track', at_risk: 'At risk', overdue: 'Overdue', done: 'Done', low: 'Low priority', medium: 'Medium priority', high: 'High priority' },
  vi: { on_track: 'Đúng tiến độ', at_risk: 'Có rủi ro', overdue: 'Quá hạn', done: 'Đã xong', low: 'Ưu tiên thấp', medium: 'Ưu tiên vừa', high: 'Ưu tiên cao' },
};

export function riskLabel(risk: Risk, language: Language) {
  return labels[language][risk];
}

export function priorityLabel(priority: Project['priority'], language: Language) {
  return labels[language][priority];
}

export function formatRiskReason(reason: RiskReason, language: Language): string {
  const vi = language === 'vi';
  const locale = vi ? 'vi-VN' : 'en-US';
  const date = (value: Date) => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(value);
  switch (reason.kind) {
    case 'overdue':
      return vi
        ? `Hạn chót là ${date(reason.due)}. Còn ${reason.count} công việc chưa hoàn thành.`
        : `The deadline was ${date(reason.due)}. ${reason.count} ${reason.count === 1 ? 'task is' : 'tasks are'} still open.`;
    case 'slipped': {
      const weekdays = reason.dates.map((day) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day));
      const from = weekdays.length ? new Intl.ListFormat(locale).format(weekdays) : vi ? 'các ngày trước' : 'earlier days';
      return vi
        ? `${reason.count} công việc bị dời từ ${from}.`
        : `${reason.count} ${reason.count === 1 ? 'task' : 'tasks'} slipped from ${from}.`;
    }
    case 'pace':
      return vi
        ? `Tốc độ hiện tại (${reason.actual} phút/ngày) thấp hơn mức cần thiết (${reason.needed} phút/ngày).`
        : `Your pace (${reason.actual} min/day) is below the ${reason.needed} min/day needed.`;
    case 'late':
      return vi
        ? `Theo tốc độ này, dự án sẽ hoàn thành vào ${date(reason.finish)}, trễ ${reason.days} ngày.`
        : `At this pace, the project finishes on ${date(reason.finish)}, ${reason.days} ${reason.days === 1 ? 'day' : 'days'} after the deadline.`;
    case 'unplaced':
      return vi
        ? `Không thể xếp ${reason.count} công việc trước hạn.`
        : `${reason.count} ${reason.count === 1 ? 'task could' : 'tasks could'} not be scheduled before the deadline.`;
    case 'empty': {
      const first = date(reason.dates[0]);
      if (reason.dates.length >= 3) return vi
        ? `Một số ngày trước hạn chưa có phiên được xếp, bắt đầu từ ${first}.`
        : `Several days before the deadline have no sessions scheduled, starting ${first}.`;
      const days = new Intl.ListFormat(locale, { type: 'disjunction' }).format(reason.dates.map(date));
      return vi ? `Chưa có phiên được xếp vào ${days}.` : `No sessions scheduled on ${days}.`;
    }
  }
}
