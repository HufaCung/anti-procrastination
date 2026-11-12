import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'vi';

const LANGUAGE_KEY = 'tinydo:language';

// Legacy screens predate the language provider and still contain English copy.
// Keep their visible UI localized while they are progressively migrated to t().
const legacyVi: Record<string, string> = {
  'Progress': 'Tiến độ', 'Last 7 days': '7 ngày qua', 'Last 30 days': '30 ngày qua',
  'Tasks completed': 'Công việc đã hoàn thành', 'Focus time': 'Thời gian tập trung',
  'Avg. session': 'Phiên trung bình', 'On-time rate': 'Tỷ lệ đúng hạn',
  'None last week either': 'Tuần trước cũng chưa có', 'Same as last week': 'Không đổi so với tuần trước',
  'No deadlines in this range': 'Không có hạn chót trong khoảng này',
  'Focus time per day': 'Thời gian tập trung mỗi ngày', 'Daily activity · 12 weeks': 'Hoạt động hằng ngày · 12 tuần',
  'No streak yet': 'Chưa có chuỗi ngày', 'Less': 'Ít', 'More': 'Nhiều',
  'Project progress & deadline risk': 'Tiến độ dự án & nguy cơ trễ hạn',
  'Progress counts completed tasks, regardless of their size. Forecasts use remaining estimates and a 7-day average of logged focus time; without history, your daily goal is shared across active projects. Forecasts are estimates, not guarantees.': 'Tiến độ được tính theo số công việc đã hoàn thành, không phụ thuộc vào độ lớn. Dự báo sử dụng thời gian ước tính còn lại và mức tập trung trung bình trong 7 ngày; khi chưa có lịch sử, mục tiêu hằng ngày được chia cho các dự án đang hoạt động. Dự báo chỉ mang tính tham khảo.',
  'Project': 'Dự án', 'Tasks': 'Công việc', 'Focus': 'Tập trung', 'Deadline': 'Hạn chót',
  'Projected': 'Dự kiến', 'Risk': 'Rủi ro',
  'No projects yet': 'Chưa có dự án', 'Progress and risk show up here once you add a project.': 'Tiến độ và rủi ro sẽ xuất hiện sau khi bạn thêm dự án.',
  'Replan unfinished tasks': 'Lên lịch lại công việc chưa xong',
  'Nothing slipped. Unfinished tasks from earlier days show up here.': 'Không có công việc bị trễ. Việc chưa xong từ những ngày trước sẽ xuất hiện tại đây.',
  'Auto-replan after 22:00 or when you return': 'Tự động lên lịch lại sau 22:00 hoặc khi bạn quay lại',
  'You’re all caught up': 'Bạn đã hoàn thành mọi việc',
  'When a scheduled task slips past its day, you’ll be able to move it here in one click.': 'Khi một công việc bị trễ ngày, bạn có thể chuyển lịch tại đây chỉ với một lần bấm.',
  'Apply replan': 'Áp dụng lịch mới', 'Undo replan': 'Hoàn tác lịch mới', 'Unscheduled': 'Chưa xếp lịch',
  'No free slot today': 'Hôm nay không còn khung giờ trống', 'No slot before deadline': 'Không còn khung giờ trước hạn chót',
  'Dashboard': 'Tổng quan', 'Plan tasks': 'Lên lịch công việc', 'New project': 'Dự án mới',
  'Start with one project': 'Bắt đầu với một dự án',
  'Add something with a deadline, split it into 10–15 minute tasks, and Plan my day places them in your week.': 'Thêm một dự án có hạn chót, chia thành các công việc 10–15 phút và dùng Lên lịch công việc để sắp xếp chúng trong tuần.',
  'Due this week': 'Đến hạn tuần này', 'Overdue': 'Quá hạn', 'Focus today': 'Tập trung hôm nay',
  'Today’s plan': 'Kế hoạch hôm nay', 'Today · 10–15 min tasks': 'Hôm nay · công việc 10–15 phút',
  'Start focus →': 'Bắt đầu tập trung →', 'Upcoming deadlines': 'Hạn chót sắp tới', 'Calendar →': 'Xem lịch →',
  'Focus this week': 'Tập trung tuần này', 'Auto-replan': 'Tự động xếp lại', 'You’re caught up': 'Bạn đã theo kịp kế hoạch',
  'No unfinished tasks from earlier days, and every project’s pace covers its deadline.': 'Không còn việc chưa xong từ những ngày trước và tiến độ của các dự án đều đáp ứng hạn chót.',
  'Review': 'Xem lại', 'Snooze': 'Nhắc lại sau', 'Replan to today': 'Xếp lại vào hôm nay',
  'Projects': 'Dự án', 'Active projects': 'Dự án đang thực hiện', 'Completed projects': 'Dự án đã hoàn thành',
  'No projects': 'Chưa có dự án',
  'Create a project with a deadline, then add the 10–15 minute tasks it takes to finish.': 'Tạo một dự án có hạn chót, sau đó thêm các công việc 10–15 phút cần thiết để hoàn thành.',
  'Calendar': 'Lịch', 'Today': 'Hôm nay', 'Tomorrow': 'Ngày mai', 'Yesterday': 'Hôm qua',
  'Scheduled tasks': 'Công việc đã xếp lịch', 'Nothing scheduled. A good day to get ahead.': 'Chưa có lịch làm việc. Đây là lúc phù hợp để chuẩn bị trước.',
  'Pull tasks from at-risk projects': 'Lấy việc từ các dự án có nguy cơ trễ', 'Next deadlines': 'Hạn chót tiếp theo',
  'No upcoming deadlines.': 'Không có hạn chót sắp tới.',
  'Focus Mode': 'Chế độ tập trung', 'Start': 'Bắt đầu', 'Pause': 'Tạm dừng', 'Resume': 'Tiếp tục',
  'No task selected': 'Chưa chọn công việc', 'Pick a task from the queue, or just focus': 'Chọn một công việc trong hàng đợi hoặc bắt đầu tập trung',
  'Exit': 'Thoát', 'Up next': 'Tiếp theo', 'Nothing scheduled today': 'Hôm nay chưa có công việc được xếp lịch',
  'Plan your day on the dashboard, or start a free session.': 'Lên kế hoạch trong trang Tổng quan hoặc bắt đầu một phiên tự do.',
  'Go to dashboard': 'Về trang Tổng quan', 'Parking lot': 'Ghi chú tạm',
  'Jot a distraction, deal with it later': 'Ghi lại điều gây xao nhãng để xử lý sau',
  'Free session · no task selected': 'Phiên tự do · chưa chọn công việc',
  'Choose a session length before starting. This session won’t be linked to a task.': 'Chọn thời lượng trước khi bắt đầu. Phiên này sẽ không được liên kết với công việc nào.',
  'Log session': 'Lưu phiên tập trung',
  'Complete task': 'Hoàn thành công việc', 'Skip': 'Bỏ qua', 'Reset': 'Đặt lại',
  'Profile & settings': 'Hồ sơ & cài đặt', 'Account': 'Tài khoản', 'Preferences': 'Tùy chọn',
  'Manage your account, focus preferences and notifications.': 'Quản lý tài khoản, tùy chọn tập trung và thông báo.',
  'Profile': 'Hồ sơ', 'Upload photo': 'Tải ảnh lên', 'Remove': 'Xóa ảnh', 'PNG or JPG, up to 2 MB.': 'Ảnh PNG hoặc JPG, tối đa 2 MB.',
  'Display name': 'Tên hiển thị', 'Username': 'Tên đăng nhập', 'Username cannot be changed.': 'Không thể thay đổi tên đăng nhập.',
  'Week starts on': 'Tuần bắt đầu vào', 'Monday': 'Thứ hai', 'Sunday': 'Chủ nhật', 'Saved': 'Đã lưu',
  'Focus & planning': 'Tập trung & lập kế hoạch', 'Appearance': 'Giao diện',
  'Applies to every screen, including Focus Mode.': 'Áp dụng cho mọi màn hình, bao gồm Chế độ tập trung.',
  'Daily focus goal': 'Mục tiêu tập trung hằng ngày', 'Used for deadline risk and replanning.': 'Dùng để tính nguy cơ trễ hạn và xếp lại lịch.',
  'Default task size': 'Thời lượng công việc mặc định', 'Pre-selected estimate when you add a task.': 'Thời lượng được chọn sẵn khi thêm công việc.',
  'Auto-replan unfinished tasks': 'Tự động xếp lại việc chưa xong',
  'Move leftovers after 22:00 while the app is open, or when you return. Uses this device’s local time.': 'Chuyển việc còn lại sau 22:00 khi ứng dụng đang mở hoặc khi bạn quay lại. Sử dụng giờ địa phương của thiết bị.',
  'Deadline alerts': 'Cảnh báo hạn chót', 'Warn 3 days, 1 day and 2 hours before a deadline.': 'Cảnh báo trước hạn chót 3 ngày, 1 ngày và 2 giờ.',
  'Focus Mode end sound': 'Âm báo kết thúc tập trung', 'Play a soft chime when a session ends.': 'Phát âm báo nhẹ khi phiên tập trung kết thúc.',
  'Password': 'Mật khẩu', 'Set when you signed up.': 'Được thiết lập khi đăng ký.', 'Change password': 'Đổi mật khẩu',
  'Log out': 'Đăng xuất', 'Current password': 'Mật khẩu hiện tại', 'New password': 'Mật khẩu mới',
  'Password reset is unavailable.': 'Hiện chưa hỗ trợ đặt lại mật khẩu.', 'Update password': 'Cập nhật mật khẩu',
  'Save changes': 'Lưu thay đổi', 'Cancel': 'Hủy', 'Delete': 'Xóa', 'Edit': 'Chỉnh sửa',
  'Create project': 'Tạo dự án', 'Add task': 'Thêm công việc', 'Task name': 'Tên công việc',
  'Project name': 'Tên dự án', 'e.g. Final report for Data Structures': 'Ví dụ: Báo cáo cuối kỳ môn Cấu trúc dữ liệu',
  'Color': 'Màu sắc', 'Project color': 'Màu dự án', 'Notes': 'Ghi chú', '(optional)': '(không bắt buộc)',
  'Scope, links, anything worth remembering': 'Phạm vi, liên kết hoặc thông tin cần ghi nhớ',
  'Edit project': 'Chỉnh sửa dự án', 'Delete project': 'Xóa dự án', 'Delete this project?': 'Xóa dự án này?',
  'Priority': 'Mức ưu tiên', 'High': 'Cao', 'Medium': 'Trung bình', 'Low': 'Thấp',
  'Status': 'Trạng thái', 'To do': 'Cần làm', 'In progress': 'Đang thực hiện', 'Done': 'Hoàn thành',
  'Description': 'Mô tả', 'Due date': 'Hạn chót', 'Estimate': 'Ước tính',
  'Admin users': 'Quản lý người dùng', 'Users': 'Người dùng', 'Role': 'Vai trò',
  'Light': 'Sáng', 'Dark': 'Tối', 'Theme': 'Giao diện', 'Language': 'Ngôn ngữ',
};

const viTokens: Record<string, string> = {
  Today: 'Hôm nay', Tomorrow: 'Ngày mai', Yesterday: 'Hôm qua',
  Sunday: 'Chủ nhật', Monday: 'Thứ hai', Tuesday: 'Thứ ba', Wednesday: 'Thứ tư', Thursday: 'Thứ năm', Friday: 'Thứ sáu', Saturday: 'Thứ bảy',
  Sun: 'CN', Mon: 'Th 2', Tue: 'Th 3', Wed: 'Th 4', Thu: 'Th 5', Fri: 'Th 6', Sat: 'Th 7',
  January: 'Tháng 1', February: 'Tháng 2', March: 'Tháng 3', April: 'Tháng 4', May: 'Tháng 5', June: 'Tháng 6',
  July: 'Tháng 7', August: 'Tháng 8', September: 'Tháng 9', October: 'Tháng 10', November: 'Tháng 11', December: 'Tháng 12',
  Jan: 'Thg 1', Feb: 'Thg 2', Mar: 'Thg 3', Apr: 'Thg 4', Jun: 'Thg 6', Jul: 'Thg 7', Aug: 'Thg 8', Sep: 'Thg 9', Oct: 'Thg 10', Nov: 'Thg 11', Dec: 'Thg 12',
};

function translateLegacyText(input: string): string {
  const leading = input.match(/^\s*/)?.[0] ?? '';
  const trailing = input.match(/\s*$/)?.[0] ?? '';
  let text = input.trim();
  if (!text) return input;
  text = legacyVi[text] ?? text;
  text = text
    .replace(/Good morning, (.+)/g, 'Chào buổi sáng, $1')
    .replace(/Good afternoon, (.+)/g, 'Chào buổi chiều, $1')
    .replace(/Good evening, (.+)/g, 'Chào buổi tối, $1')
    .replace(/(.+)[’']s workspace/g, 'Không gian làm việc của $1')
    .replace(/(\d+) active · (\d+) completed/g, '$1 đang thực hiện · $2 đã hoàn thành')
    .replace(/Member since (.+)/g, 'Thành viên từ $1')
    .replace(/(\d+h(?: \d+m)?) \/ day/g, '$1 / ngày')
    .replace(/Goal (\d+h(?: \d+m)?) · dashed line/g, 'Mục tiêu $1 · đường nét đứt')
    .replace(/(\d+) sessions? · target 10–15 min/g, '$1 phiên · mục tiêu 10–15 phút')
    .replace(/(\d+) min left/g, 'Còn $1 phút')
    .replace(/\+(\d+) min/g, '+$1 phút')
    .replace(/(\d+) min\b/g, '$1 phút')
    .replace(/(\d+)m\b/g, '$1 phút')
    .replace(/(\d+)-day streak/g, 'Chuỗi $1 ngày')
    .replace(/(\d+) tasks? done/g, '$1 công việc đã xong')
    .replace(/(\d+) tasks?/g, '$1 công việc')
    .replace(/(\d+) sessions?/g, '$1 phiên')
    .replace(/In (\d+) days/g, 'Còn $1 ngày')
    .replace(/(\d+) days ago/g, '$1 ngày trước');
  for (const [from, to] of Object.entries(viTokens)) text = text.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  text = text
    .replace(/(Chủ nhật|Thứ (?:hai|ba|tư|năm|sáu|bảy)), Tháng (\d+) (\d+)/g, '$1, ngày $3 tháng $2')
    .replace(/(Chủ nhật|Thứ (?:hai|ba|tư|năm|sáu|bảy)), Thg (\d+) (\d+)/g, '$1, ngày $3 tháng $2')
    .replace(/(CN|Th \d), Thg (\d+) (\d+)/g, '$1, ngày $3 tháng $2');
  return leading + text + trailing;
}

const legacyOriginalText = new WeakMap<Text, string>();

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
    appLanguage: 'App language', appLanguageHint: 'Changes navigation, authentication and common interface labels.',
    loginTitle: 'Log in', welcomeBack: 'Welcome back', loginLead: 'Log in to pick up where you left off.', username: 'Username', yourUsername: 'Your username', password: 'Password', loggingIn: 'Logging in…', login: 'Log in', newHere: 'NEW HERE?', createAccount: 'Create an account',
    loginQuote: 'Big deadlines, broken into 15-minute steps you can actually start.', seeDue: 'See what’s due', seeDueBody: 'Deadlines, risk and a calendar of your planned sessions in one place.', startSmall: 'Start small', startSmallBody: 'Split each project into 10–15 minute tasks and watch progress add up.', stayWithIt: 'Stay with it', stayWithItBody: 'Focus Mode times each task and logs your progress.',
    createTitle: 'Create account', haveAccount: 'Have an account?', createWorkspace: 'Create your workspace', createLead: 'Free for personal use. Set up takes about a minute.', confirmPassword: 'Confirm password', creatingAccount: 'Creating account…', alreadyAccount: 'Already have an account?',
    passwordHint: 'Use 8+ characters with a mix of letters, numbers and symbols.', passwordStrength: 'Password strength', weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong',
    finishOnTime: 'Everything you need to finish on time.', deadlineManager: 'Deadline Manager', deadlineBody: 'Priorities, a calendar and warnings before anything slips.', focusBody: 'Work through 10–15 minute tasks with a timer that keeps your place.', progressTracker: 'Progress Tracker', progressBody: 'See focus time and deadline risk, and replan unfinished work automatically.',
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
    appLanguage: 'Ngôn ngữ ứng dụng', appLanguageHint: 'Thay đổi điều hướng, đăng nhập và các nhãn giao diện thông dụng.',
    loginTitle: 'Đăng nhập', welcomeBack: 'Chào mừng trở lại', loginLead: 'Đăng nhập để tiếp tục công việc của bạn.', username: 'Tên đăng nhập', yourUsername: 'Nhập tên đăng nhập', password: 'Mật khẩu', loggingIn: 'Đang đăng nhập…', login: 'Đăng nhập', newHere: 'CHƯA CÓ TÀI KHOẢN?', createAccount: 'Tạo tài khoản',
    loginQuote: 'Chia deadline lớn thành những bước 15 phút mà bạn có thể bắt đầu ngay.', seeDue: 'Nắm rõ hạn chót', seeDueBody: 'Theo dõi deadline, rủi ro và lịch các phiên làm việc tại một nơi.', startSmall: 'Bắt đầu từ việc nhỏ', startSmallBody: 'Chia mỗi dự án thành các việc 10–15 phút và theo dõi tiến độ.', stayWithIt: 'Duy trì tập trung', stayWithItBody: 'Chế độ tập trung tính giờ và ghi lại tiến độ của bạn.',
    createTitle: 'Tạo tài khoản', haveAccount: 'Đã có tài khoản?', createWorkspace: 'Tạo không gian làm việc', createLead: 'Miễn phí cho mục đích cá nhân. Chỉ mất khoảng một phút.', confirmPassword: 'Xác nhận mật khẩu', creatingAccount: 'Đang tạo tài khoản…', alreadyAccount: 'Đã có tài khoản?',
    passwordHint: 'Dùng ít nhất 8 ký tự gồm chữ, số và ký hiệu.', passwordStrength: 'Độ mạnh mật khẩu', weak: 'Yếu', fair: 'Trung bình', good: 'Tốt', strong: 'Mạnh',
    finishOnTime: 'Mọi thứ bạn cần để hoàn thành đúng hạn.', deadlineManager: 'Quản lý deadline', deadlineBody: 'Ưu tiên, lịch và cảnh báo trước khi công việc trễ hạn.', focusBody: 'Làm các việc 10–15 phút với bộ đếm giờ luôn ghi nhớ tiến độ.', progressTracker: 'Theo dõi tiến độ', progressBody: 'Xem thời gian tập trung, rủi ro deadline và tự động xếp lại việc chưa xong.',
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
    const attributeNames = ['placeholder', 'title', 'aria-label'] as const;

    const localize = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text);
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style')) continue;
        if (language === 'vi') {
          const translated = translateLegacyText(node.data);
          if (translated !== node.data) {
            if (!legacyOriginalText.has(node)) legacyOriginalText.set(node, node.data);
            node.data = translated;
          }
        } else {
          const original = legacyOriginalText.get(node);
          if (original != null) node.data = original;
        }
      }
      const elements = root.nodeType === Node.ELEMENT_NODE
        ? [root as Element, ...(root as Element).querySelectorAll('*')]
        : [];
      for (const el of elements) {
        for (const attr of attributeNames) {
          const value = el.getAttribute(attr);
          const backup = `data-i18n-${attr.replace('aria-', '')}`;
          if (language === 'vi' && value) {
            const translated = translateLegacyText(value);
            if (translated !== value) {
              if (!el.hasAttribute(backup)) el.setAttribute(backup, value);
              el.setAttribute(attr, translated);
            }
          } else if (language === 'en' && el.hasAttribute(backup)) {
            el.setAttribute(attr, el.getAttribute(backup)!);
            el.removeAttribute(backup);
          }
        }
      }
    };

    localize(document.documentElement);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') localize(mutation.target);
        for (const node of mutation.addedNodes) localize(node);
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
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
