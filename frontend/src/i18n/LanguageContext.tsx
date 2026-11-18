import { dateCopy } from './dates';
import { translateCopy, type CopyKey } from './copy';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'vi';

const LANGUAGE_KEY = 'tinydo:language';

const messages = {
  en: {
    language: 'Language', english: 'English', vietnamese: 'Tiếng Việt',
    main: 'Main', more: 'More', less: 'Less', newTask: 'New task',
    dashboard: 'Dashboard', projects: 'Projects', calendar: 'Calendar', focusMode: 'Focus Mode', progress: 'Progress', teams: 'Teams', adminUsers: 'Admin users',
    search: 'Search', searchAria: 'Search tasks and projects', searchResults: 'Search results', noMatches: 'No matches for',
    allSynced: 'All changes synced', syncing: 'Syncing...', retrying: 'Connection interrupted. Retrying sync...',
    syncConflict: 'Sync paused: server has newer data. Local changes kept.', syncError: 'Sync paused. Local changes kept.', loadingData: 'Loading server data...', retrySync: 'Retry sync',
    projectList: 'PROJECTS', due: 'Due', createFirstProject: 'Create your first project', overdue: 'Overdue', completed: 'Completed', done: 'done', taskList: 'TASKS',
    todayFocus: 'Today’s focus', focusGoal: 'Today’s focus versus goal', noStreak: 'No streak yet', dayStreak: 'day streak', task: 'task', tasks: 'tasks',
    profileSettings: 'Profile & settings', logout: 'Log out', theme: 'Theme', light: 'Light', dark: 'Dark',
    appLanguage: 'App language', appLanguageHint: 'Sets the language of the workspace.',
    loginTitle: 'Log in', welcomeBack: 'Welcome back', loginLead: 'Log in to pick up where you left off.', username: 'Username', yourUsername: 'Your username', password: 'Password', loggingIn: 'Logging in…', login: 'Log in', newHere: 'NEW HERE?', createAccount: 'Create an account',
    loginQuote: 'Big deadlines, broken into 15-minute steps you can actually start.', seeDue: 'See what’s due', seeDueBody: 'Deadlines, risk and a calendar of your planned sessions in one place.', startSmall: 'Start small', startSmallBody: 'Split each project into 10–15 minute tasks and watch progress add up.', stayWithIt: 'Stay with it', stayWithItBody: 'Focus Mode times each task and logs your progress.',
    createTitle: 'Create account', haveAccount: 'Have an account?', createWorkspace: 'Create your workspace', createLead: 'Free for personal use. Set up takes about a minute.', confirmPassword: 'Confirm password', creatingAccount: 'Creating account…', alreadyAccount: 'Already have an account?',
    passwordHint: 'Use 8+ characters with a mix of letters, numbers and symbols.', passwordStrength: 'Password strength', weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong',
    finishOnTime: 'Everything you need to finish on time.', deadlineManager: 'Deadline Manager', deadlineBody: 'Priorities, a calendar and warnings before anything slips.', focusBody: 'Work through 10–15 minute tasks with a timer that keeps your place.', progressTracker: 'Progress Tracker', progressBody: 'See focus time and deadline risk, and replan unfinished work automatically.',
    forgotTitle: 'Forgot your password?', resetUnavailable: 'Email password reset is currently unavailable. If you are signed in, you can change your password in settings.', backToSettings: 'Back to settings', backToLogin: 'Back to log in',
    home: 'TinyDo home', loadingWorkspace: 'Loading your workspace...',
  },
  vi: {
    language: 'Ngôn ngữ', english: 'English', vietnamese: 'Tiếng Việt',
    main: 'Chính', more: 'Thêm', less: 'Thu gọn', newTask: 'Thêm công việc',
    dashboard: 'Tổng quan', projects: 'Dự án', calendar: 'Lịch', focusMode: 'Tập trung', progress: 'Tiến độ', teams: 'Nhóm', adminUsers: 'Quản lý người dùng',
    search: 'Tìm kiếm', searchAria: 'Tìm công việc và dự án', searchResults: 'Kết quả tìm kiếm', noMatches: 'Không tìm thấy kết quả cho',
    allSynced: 'Đã đồng bộ mọi thay đổi', syncing: 'Đang đồng bộ...', retrying: 'Mất kết nối. Đang thử đồng bộ lại...',
    syncConflict: 'Tạm dừng đồng bộ: máy chủ có dữ liệu mới hơn. Dữ liệu cục bộ vẫn được giữ.', syncError: 'Tạm dừng đồng bộ. Dữ liệu cục bộ vẫn được giữ.', loadingData: 'Đang tải dữ liệu...', retrySync: 'Thử đồng bộ lại',
    projectList: 'DỰ ÁN', due: 'Hạn', createFirstProject: 'Tạo dự án đầu tiên', overdue: 'Quá hạn', completed: 'Đã hoàn thành', done: 'xong', taskList: 'CÔNG VIỆC',
    todayFocus: 'Tập trung hôm nay', focusGoal: 'Thời gian tập trung hôm nay so với mục tiêu', noStreak: 'Chưa có chuỗi ngày', dayStreak: 'ngày liên tiếp', task: 'công việc', tasks: 'công việc',
    profileSettings: 'Hồ sơ & cài đặt', logout: 'Đăng xuất', theme: 'Giao diện', light: 'Sáng', dark: 'Tối',
    appLanguage: 'Ngôn ngữ ứng dụng', appLanguageHint: 'Chọn ngôn ngữ cho không gian làm việc.',
    loginTitle: 'Đăng nhập', welcomeBack: 'Chào mừng trở lại', loginLead: 'Đăng nhập để tiếp tục công việc của bạn.', username: 'Tên đăng nhập', yourUsername: 'Nhập tên đăng nhập', password: 'Mật khẩu', loggingIn: 'Đang đăng nhập…', login: 'Đăng nhập', newHere: 'CHƯA CÓ TÀI KHOẢN?', createAccount: 'Tạo tài khoản',
    loginQuote: 'Chia deadline lớn thành những bước 15 phút mà bạn có thể bắt đầu ngay.', seeDue: 'Nắm rõ hạn chót', seeDueBody: 'Theo dõi deadline, rủi ro và lịch các phiên làm việc tại một nơi.', startSmall: 'Bắt đầu từ việc nhỏ', startSmallBody: 'Chia mỗi dự án thành các việc 10–15 phút và theo dõi tiến độ.', stayWithIt: 'Duy trì tập trung', stayWithItBody: 'Chế độ tập trung tính giờ và ghi lại tiến độ của bạn.',
    createTitle: 'Tạo tài khoản', haveAccount: 'Đã có tài khoản?', createWorkspace: 'Tạo không gian làm việc', createLead: 'Miễn phí cho mục đích cá nhân. Chỉ mất khoảng một phút.', confirmPassword: 'Xác nhận mật khẩu', creatingAccount: 'Đang tạo tài khoản…', alreadyAccount: 'Đã có tài khoản?',
    passwordHint: 'Dùng ít nhất 8 ký tự gồm chữ, số và ký hiệu.', passwordStrength: 'Độ mạnh mật khẩu', weak: 'Yếu', fair: 'Trung bình', good: 'Tốt', strong: 'Mạnh',
    finishOnTime: 'Mọi thứ bạn cần để hoàn thành đúng hạn.', deadlineManager: 'Quản lý deadline', deadlineBody: 'Ưu tiên, lịch và cảnh báo trước khi công việc trễ hạn.', focusBody: 'Làm các việc 10–15 phút với bộ đếm giờ luôn ghi nhớ tiến độ.', progressTracker: 'Theo dõi tiến độ', progressBody: 'Xem thời gian tập trung, rủi ro deadline và tự động xếp lại việc chưa xong.',
    forgotTitle: 'Bạn quên mật khẩu?', resetUnavailable: 'Hiện chưa thể đặt lại mật khẩu qua email. Nếu đã đăng nhập, bạn có thể đổi mật khẩu trong phần cài đặt.', backToSettings: 'Về cài đặt', backToLogin: 'Về trang đăng nhập',
    home: 'Trang chủ TinyDo', loadingWorkspace: 'Đang tải không gian làm việc...',
  },
} as const;

type MessageKey = keyof typeof messages.en;
interface LanguageValue { language: Language; setLanguage: (language: Language) => void; t: (key: MessageKey) => string; }
const LanguageCtx = createContext<LanguageValue | null>(null);

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'vi') return saved;
  } catch { /* storage unavailable */ }
  return navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* storage unavailable */ }
  };
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo<LanguageValue>(() => ({ language, setLanguage, t: (key) => messages[language][key] }), [language]);
  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageCtx);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="seg" role="radiogroup" aria-label={t('language')} style={compact ? { width: 'auto' } : undefined}>
      <button type="button" role="radio" aria-checked={language === 'en'} tabIndex={language === 'en' ? 0 : -1} onClick={() => setLanguage('en')}>EN</button>
      <button type="button" role="radio" aria-checked={language === 'vi'} tabIndex={language === 'vi' ? 0 : -1} onClick={() => setLanguage('vi')}>VI</button>
    </div>
  );
}

export function useCopy() {
  const { language } = useLanguage();
  return useCallback((key: CopyKey, ...values: (string | number)[]) => translateCopy(language, key, ...values), [language]);
}

export function useDateCopy() {
  const { language } = useLanguage();
  return dateCopy(language);
}
