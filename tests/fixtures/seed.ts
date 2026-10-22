/**
 * TEST FIXTURE ONLY — never shipped in the app.
 * A realistic workspace from the design (which assumes today = Thu, Oct 22, 2026),
 * used by unit and end-to-end tests. Every date is relative to `now`.
 */
import type { AppData, FocusSession, Priority, Project, Task, TaskStatus } from '../../src/data/types';
import { addDays, dayKey, startOfDay } from '../../src/logic/dates';
import { schedule } from '../../src/logic/schedule';
import { uid } from '../../src/logic/ids';


type T = [title: string, est: number, status?: TaskStatus];

interface ProjectSpec {
  key: string;
  name: string;
  color: string;
  priority: Priority;
  due: number; // day offset
  created: number; // day offset
  description: string;
  completed?: number; // day offset of completion
  sections: [string, T[]][];
}

const D: TaskStatus = 'done';
const P: TaskStatus = 'in_progress';

const SPECS: ProjectSpec[] = [
  {
    key: 'essay', name: 'Scholarship essay', color: '#D92D20', priority: 'high', due: -1, created: -20,
    description: '650-word personal essay for the Global Futures scholarship.',
    sections: [
      ['Draft', [['Brainstorm 3 personal stories', 15, D], ['Pick the strongest story', 10, D], ['Draft the opening hook', 15, D], ['Outline intro paragraph', 10, D], ['Write "why this field" section', 15, D]]],
      ['Finish', [['Read the essay aloud once', 15], ['Proofread essay and trim to 650 words', 15, P], ['Submit essay on portal', 10]]],
    ],
  },
  {
    key: 'obby', name: 'Obby Lesson Pack', color: '#5E5CE6', priority: 'medium', due: 5, created: -18,
    description: 'Four beginner lessons on building an obby in Roblox Studio for Roblox Class.',
    sections: [
      ['Lesson 1 · Setup', [['Write lesson goals', 10, D], ['Make starter place template', 15, D], ['Record Studio tour clip', 15, D], ['Write setup worksheet', 15, D], ['Create lesson 1 slides', 15, D], ['Test template on a school laptop', 10, D]]],
      ['Lesson 2 · Checkpoints', [['Script checkpoint spawn logic', 15, D], ['Write checkpoint explainer', 15, D], ['Record checkpoint walkthrough clip', 15, D], ['Create lesson 2 slides', 15, D], ['Add challenge: moving platform', 15, D], ['Build checkpoint demo place', 15]]],
      ['Lesson 3 · Kill bricks', [['Script kill brick with Touched event', 15, D], ['Record kill-brick demo', 15, D], ['Create lesson 3 slides', 15, D], ['Write kill-brick script worksheet', 15], ['Add debugging tips page', 10, D], ['Write teacher notes for lesson 3', 10, D]]],
      ['Lesson 4 · Quiz & wrap-up', [['Draft lesson 4 outline', 10, D], ['Collect student showcase examples', 10, D], ['Write lesson 4 quiz', 10], ['Make quiz answer key', 10], ['Playtest with 2 students', 15], ['Fix playtest issues', 15], ['Share pack with Roblox Class', 10]]],
    ],
  },
  {
    key: 'thesis', name: 'Thesis · Chapter 3', color: '#E07B00', priority: 'high', due: 8, created: -25,
    description: 'Chapter 3 — Methods: research design, participants, instruments and analysis plan.',
    sections: [
      ['3.1 Research design', [['Pick mixed-methods framing and cite 2 sources', 15, D], ['Draft design rationale paragraph', 15, D], ['Add design diagram to figures', 10, D]]],
      ['3.2 Participants', [['Write inclusion / exclusion criteria', 15, D], ['Justify sample size (n = 120)', 15, D], ['Describe recruitment channels', 10, P], ['Add demographics table shell', 10]]],
      ['3.3 Instruments', [['Summarise survey scales and reliability', 15, D], ['Write interview protocol overview', 15], ['Move full questionnaire to appendix', 10], ['Explain pilot test changes', 15]]],
      ['3.4 Analysis plan', [['Summarise 2 papers for methods table', 15], ['Describe data cleaning steps', 15], ['Choose regression model and justify', 15], ['Outline thematic coding process', 15], ['Send section to supervisor for comments', 10]]],
    ],
  },
  {
    key: 'q4', name: 'Q4 Launch Site', color: '#0E9384', priority: 'medium', due: 15, created: -28,
    description: 'Marketing site for the Q4 product launch: wireframes, copy, build and QA.',
    sections: [
      ['Discovery', [['List launch goals and audience', 15, D], ['Audit current site pages', 15, D], ['Collect 5 competitor examples', 15, D], ['Draft sitemap', 10, D], ['Agree on page list with team', 10, D]]],
      ['Wireframes', [['Wireframe home hero', 15, D], ['Wireframe features section', 15, D], ['Wireframe pricing table', 15, D], ['Wireframe FAQ and footer', 10, D], ['Mobile wireframe pass', 15, D], ['Review wireframes with design lead', 10, D]]],
      ['Copy', [['Write hero headline options', 15, D], ['Write feature blurbs', 15, D], ['Write pricing copy', 15, D], ['Write FAQ answers', 15, D], ['Copy review with marketing', 10, D], ['Apply copy feedback', 15, D]]],
      ['Build', [['Set up page template', 15, D], ['Build hero section', 15, D], ['Build features grid', 15, D], ['Build pricing table', 15, D], ['Build FAQ accordion', 15], ['Build footer and legal links', 10], ['Add analytics events', 15], ['Optimise images', 15], ['Wire up signup form', 15]]],
      ['QA & launch', [['Cross-browser check', 15], ['Mobile QA pass', 15], ['Accessibility audit', 15], ['Fix QA issues', 15], ['Lighthouse performance pass', 15], ['Write launch checklist', 10], ['Set up redirects', 10], ['Final stakeholder review', 15], ['Launch and monitor', 15], ['Post-launch fixes', 15]]],
    ],
  },
  {
    key: 'portfolio', name: 'Portfolio redesign', color: '#8A8A86', priority: 'low', due: 29, created: -10,
    description: 'Refresh the personal portfolio with three new case studies.',
    sections: [
      ['Plan', [['List 3 case studies to feature', 10, D], ['Collect screenshots for each', 15, D], ['Sketch new homepage layout', 15, D], ['Pick typography and colors', 15]]],
      ['Case studies', [['Draft case study 1 story', 15], ['Draft case study 2 story', 15], ['Draft case study 3 story', 15], ['Edit case study visuals', 15], ['Write project outcomes', 15]]],
      ['Build', [['Set up site repo', 10], ['Build homepage', 15], ['Build case study template', 15], ['Build about page', 15], ['Add contact form', 10], ['Responsive pass', 15]]],
      ['Launch', [['Proofread every page', 15], ['Ask 2 friends for feedback', 10], ['Apply feedback', 15], ['Set up custom domain', 10], ['Publish and share', 10]]],
    ],
  },
  // Finished projects give the heatmap and on-time rate real history.
  {
    key: 'quiz', name: 'Statistics quiz prep', color: '#0BA5EC', priority: 'medium', due: -4, created: -14, completed: -5,
    description: 'Revise chapters 4–6 for the statistics quiz.',
    sections: [['Revision', [['List quiz topics', 10, D], ['Review notes on distributions', 15, D], ['Practise 10 probability questions', 15, D], ['Review hypothesis testing', 15, D], ['Practise past quiz', 15, D], ['Note weak spots to revisit', 10, D], ['Redo weak-spot questions', 15, D]]]],
  },
  {
    key: 'reading', name: 'Reading response #3', color: '#4CA30D', priority: 'low', due: -9, created: -16, completed: -10,
    description: '500-word response to the week 7 reading.',
    sections: [['Response', [['Read the article and highlight', 15, D], ['List 3 arguments to respond to', 10, D], ['Draft response', 15, D], ['Edit and cite', 15, D], ['Submit response', 10, D]]]],
  },
  {
    key: 'lab', name: 'Lab report 2', color: '#B54708', priority: 'high', due: -12, created: -26, completed: -13,
    description: 'Write up the pendulum experiment.',
    sections: [['Report', [['Clean the raw data', 15, D], ['Make 2 charts', 15, D], ['Write method section', 15, D], ['Write results', 15, D], ['Write discussion', 15, D], ['Format references', 10, D], ['Submit report', 10, D]]]],
  },
  {
    key: 'midterm', name: 'Midterm study plan', color: '#7F56D9', priority: 'high', due: -38, created: -70, completed: -39,
    description: 'Prepare for three midterm exams.',
    sections: [['Revision', Array.from({ length: 24 }, (_, i): T => [[`Review lecture ${i + 1} notes`, `Practise problem set ${Math.floor(i / 2) + 1}`, `Summarise chapter ${i + 1}`][i % 3], 15, D])]],
  },
  {
    key: 'club', name: 'Club website refresh', color: '#DD2590', priority: 'low', due: -45, created: -84, completed: -46,
    description: 'Refresh the robotics club website.',
    sections: [['Refresh', Array.from({ length: 18 }, (_, i): T => [[`Update page ${i + 1} copy`, `Replace photos on page ${i + 1}`, `Fix links on page ${i + 1}`][i % 3], 15, D])]],
  },
];

/** Hand-placed slots from the design (today = offset 0). */
const SLOTS: Record<string, [day: number, time: string]> = {
  'Brainstorm 3 personal stories': [-5, '19:00'],
  'Pick the strongest story': [-4, '19:00'],
  'Draft the opening hook': [-3, '19:30'],
  'Read the essay aloud once': [-1, '16:00'],
  'Outline intro paragraph': [0, '08:30'],
  'Write "why this field" section': [0, '08:45'],
  'Record checkpoint walkthrough clip': [0, '10:00'],
  'Proofread essay and trim to 650 words': [0, '14:00'],
  'Submit essay on portal': [0, '14:20'],
  'Summarise 2 papers for methods table': [0, '15:00'],
  'Write kill-brick script worksheet': [0, '16:00'],
  'Describe recruitment channels': [-1, '09:00'],
  'Add demographics table shell': [-1, '09:15'],
  'Write interview protocol overview': [-1, '09:30'],
  'Explain pilot test changes': [-1, '09:50'],
};

function at(now: Date, day: number, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = addDays(startOfDay(now), day);
  d.setHours(h, m, 0, 0);
  return d;
}

function clampPast(d: Date, now: Date): Date {
  return d.getTime() > now.getTime() ? new Date(Math.max(startOfDay(now).getTime(), now.getTime() - 60_000)) : d;
}

/** Simple deterministic PRNG so the demo looks the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildSeed(userId: string, now: Date, dailyGoalMin = 180): Pick<AppData, 'projects' | 'tasks' | 'sessions'> {
  const projects: Project[] = [];
  const tasks: Task[] = [];
  const sessions: FocusSession[] = [];
  const pid: Record<string, string> = {};
  const rand = rng(20261022);

  for (const spec of SPECS) {
    const id = uid('p_');
    pid[spec.key] = id;
    projects.push({
      id, userId, name: spec.name, color: spec.color, description: spec.description, priority: spec.priority,
      dueDate: dayKey(addDays(now, spec.due)),
      createdAt: at(now, spec.created, '09:00').toISOString(),
      ...(spec.completed != null ? { completedAt: at(now, spec.completed, '20:00').toISOString() } : {}),
    });

    const flat: { section: string; t: T }[] = [];
    spec.sections.forEach(([section, list]) => list.forEach((t) => flat.push({ section, t })));
    // Done tasks without a hand-placed slot are spread evenly between creation and yesterday
    // (or the completion day for finished projects).
    const lastDay = spec.completed ?? -1;
    const freeDone = flat.filter((f) => f.t[2] === D && !SLOTS[f.t[0]]);
    const span = Math.max(1, lastDay - (spec.created + 1));

    flat.forEach(({ section, t }, order) => {
      const [title, est, status = 'todo'] = t;
      const task: Task = {
        id: uid('t_'), userId, projectId: id, section, title, estimateMin: est, status, order,
        createdAt: at(now, spec.created, '09:05').toISOString(),
      };
      const slot = SLOTS[title];
      if (slot) {
        task.scheduledFor = at(now, slot[0], slot[1]).toISOString();
        if (status === 'done') {
          task.completedAt = clampPast(new Date(new Date(task.scheduledFor).getTime() + est * 60_000), now).toISOString();
        }
      } else if (status === 'done') {
        const i = freeDone.findIndex((f) => f.t === t);
        const day = spec.created + 1 + Math.round(((i + 0.5) / Math.max(1, freeDone.length)) * span);
        const hour = 9 + Math.floor(rand() * 10);
        const start = at(now, Math.min(day, lastDay), `${String(hour).padStart(2, '0')}:${rand() < 0.5 ? '00' : '30'}`);
        task.scheduledFor = start.toISOString();
        task.completedAt = new Date(start.getTime() + est * 60_000).toISOString();
      }
      tasks.push(task);
    });
  }

  // Remaining unscheduled work is spread from tomorrow, a little under the daily goal,
  // so the calendar shows a realistic plan.
  const tomorrow = addDays(startOfDay(now), 1);
  const unscheduled = tasks.filter((t) => t.status !== 'done' && !t.scheduledFor);
  const res = schedule(unscheduled, { dailyGoalMin: Math.min(dailyGoalMin, 100) }, tasks, projects, tomorrow);
  const placed = new Map(res.placements.map((p) => [p.taskId, p.to]));
  tasks.forEach((t) => {
    const to = placed.get(t.id);
    if (to) t.scheduledFor = to;
  });

  // ---- Focus sessions (≈ 30 days) ----
  const add = (projectKey: string | undefined, start: Date, minutes: number, taskId?: string, completedTask = false) => {
    const s = clampPast(start, now);
    sessions.push({
      id: uid('s_'), userId, projectId: projectKey ? pid[projectKey] : undefined, taskId,
      startedAt: s.toISOString(), endedAt: new Date(s.getTime() + minutes * 60_000).toISOString(),
      minutes, completedTask,
    });
  };
  const taskByTitle = (title: string) => tasks.find((t) => t.title === title);

  // Today: 1h 35m across 7 sessions.
  const today: [string, string, number, string?][] = [
    ['thesis', '07:00', 25], ['thesis', '07:30', 15],
    ['essay', '08:30', 10, 'Outline intro paragraph'], ['essay', '08:45', 15, 'Write "why this field" section'],
    ['obby', '10:00', 15, 'Record checkpoint walkthrough clip'], ['thesis', '11:00', 15],
  ];
  today.forEach(([k, time, m, title]) => {
    const t = title ? taskByTitle(title) : undefined;
    add(k, at(now, 0, time), m, t?.id, !!t);
  });

  // Last 6 days: fixed per-project mix that keeps the demo's risk picture
  // (Obby on track, Thesis/Q4 at risk, Portfolio on track).
  const essayByDay = [60, 10, 0, 70, 50, 100]; // offsets -6..-1
  for (let i = 0; i < 6; i++) {
    const off = -6 + i;
    const mix: [string, number][] = [['obby', 25], ['thesis', 27], ['q4', 8], ['portfolio', 10], ['essay', essayByDay[i]]];
    let clock = 9 * 60;
    mix.forEach(([k, total]) => {
      let left = total;
      while (left > 0) {
        const m = Math.min(left, left >= 25 ? 25 : left);
        const t = at(now, off, '00:00');
        t.setMinutes(clock);
        add(k, t, m);
        clock += m + 15;
        left -= m;
      }
    });
  }

  // Older history: 23 days before that, matching the design's 30-day chart shape.
  const older = [80, 120, 95, 0, 30, 150, 140, 110, 90, 160, 45, 20, 130, 170, 100, 125, 140, 0, 60, 155, 180, 120, 135];
  older.forEach((total, i) => {
    const off = -29 + i;
    const active = SPECS.filter((s) => s.created < off && (s.completed ?? s.due) >= off).map((s) => s.key);
    if (active.length === 0 || total === 0) return;
    let left = total;
    let clock = 9 * 60 + Math.floor(rand() * 4) * 30;
    let j = Math.floor(rand() * active.length);
    while (left > 0) {
      const m = Math.min(left, [10, 15, 15, 25][Math.floor(rand() * 4)]);
      const t = at(now, off, '00:00');
      t.setMinutes(clock);
      add(active[j % active.length], t, m);
      clock += m + 10;
      left -= m;
      j++;
    }
  });
  // Light activity for the long-finished projects (outside the 30-day window).
  for (let off = -84; off <= -30; off += 2) {
    const active = SPECS.filter((s) => s.created < off && (s.completed ?? 0) >= off).map((s) => s.key);
    if (active.length === 0) continue;
    add(active[0], at(now, off, '18:00'), 25);
    add(active[active.length - 1], at(now, off, '19:00'), 15);
  }

  return { projects, tasks, sessions };
}
