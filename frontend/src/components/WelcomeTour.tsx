import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/AppStore';

type Step = { target: string; eyebrow: string; title: string; body: string };
type Tour = { userId: string; kind: 'project' | 'dashboard' };
const KEY = 'tinydo:welcome-tour';

const projectSteps: Step[] = [
  { target: 'add-task', eyebrow: 'BREAK IT DOWN', title: 'Turn a big project into small steps', body: 'Add a task here. Once it’s added, open its ⋮ menu and choose Add subtask to break it into smaller steps.' },
  { target: 'estimate', eyebrow: 'KEEP IT SMALL', title: 'Pick a time estimate', body: 'Choose how long this step might take. Around 10–15 minutes is a friendly place to start.' },
  { target: 'quick-task', eyebrow: 'ADD FROM ANYWHERE', title: 'A quick way to add tasks', body: 'Use this plus button to add another task to a project without leaving the page you’re on.' },
  { target: 'focus', eyebrow: 'ONE THING AT A TIME', title: 'Settle into Focus Mode', body: 'Choose a task and start a timer. Your focus time and completed tasks are recorded for you.' },
  { target: 'calendar', eyebrow: 'SEE YOUR WEEK', title: 'Make room for your plans', body: 'Your scheduled tasks appear on the calendar, so you can see what’s coming up.' },
];
const dashboardSteps: Step[] = [
  { target: 'new-project', eyebrow: 'START HERE', title: 'Give your goal a home', body: 'Create a project for something you want to finish, then add its deadline and priority.' },
  { target: 'quick-task', eyebrow: 'BREAK IT DOWN', title: 'Add small tasks', body: 'Once you have a project, use this plus button to add manageable steps. TinyDo keeps those tasks inside your project.' },
  ...projectSteps.slice(3),
];

function readTour(userId: string): Tour | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Tour | null;
    return value?.userId === userId && (value.kind === 'project' || value.kind === 'dashboard') ? value : null;
  } catch { return null; }
}

export function WelcomeTour() {
  const { user } = useStore();
  const location = useLocation();
  const [tour, setTour] = useState<Tour | null>(() => user ? readTour(user.id) : null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(250);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const steps = tour?.kind === 'project' && location.pathname.startsWith('/projects/') ? projectSteps : dashboardSteps;
  const step = steps[index];

  const close = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    setTour(null);
    returnFocus.current?.focus();
  };

  useLayoutEffect(() => {
    if (!tour || !step) return;
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!target) { setRect(null); return; }
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    const update = () => setRect(target.getBoundingClientRect());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [tour, step]);

  useEffect(() => {
    if (!tour) return;
    if (!returnFocus.current) returnFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
  }, [tour]);

  useLayoutEffect(() => {
    const card = dialogRef.current;
    if (!tour || !card) return;
    const update = () => setCardHeight(card.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(card);
    return () => observer.disconnect();
  }, [tour]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!buttons.length) return;
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.shiftKey && current <= 0) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && (current < 0 || current === buttons.length - 1)) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tour]);

  if (!tour || !step) return null;
  const width = Math.min(340, window.innerWidth - 32);
  const left = rect ? Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + rect.width / 2 - width / 2)) : (window.innerWidth - width) / 2;
  const below = rect && rect.bottom + cardHeight + 38 < window.innerHeight;
  const desiredTop = rect ? (below ? rect.bottom + 22 : rect.top - cardHeight - 22) : (window.innerHeight - cardHeight) / 2;
  const top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, desiredTop));
  const visible = rect && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  const clipped = visible && { top: Math.max(4, rect.top - 6), left: Math.max(4, rect.left - 6), width: Math.min(window.innerWidth - Math.max(4, rect.left - 6) - 4, rect.width + 12), height: Math.min(window.innerHeight - Math.max(4, rect.top - 6) - 4, rect.height + 12) };

  return createPortal(
    <div className="tour-layer">
      {clipped ? <div className="tour-spotlight" style={clipped} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}
      <div className="tour-card" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" style={{ top, left, width }}>
        <div className={`tour-pointer ${below ? 'above' : 'below'}`} style={{ left: rect ? Math.max(16, Math.min(width - 44, rect.left + rect.width / 2 - left - 14)) : 24 }} aria-hidden="true">
          <svg width="28" height="32" viewBox="0 0 28 32" fill="none"><path d="M4 2 22 19l-8 .4-3.5 8L4 2Z" fill="#5e5ce6" stroke="white" strokeWidth="2" strokeLinejoin="round" /></svg>
        </div>
        <div className="tour-topline"><span>{step.eyebrow}</span><span>{index + 1} / {steps.length}</span></div>
        <h2 id="tour-title" aria-live="polite">{step.title}</h2>
        <p id="tour-description">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={close}>Skip tour</button>
          <div className="tour-navigation">
            {index > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIndex(index - 1)}>Back</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => index === steps.length - 1 ? close() : setIndex(index + 1)}>{index === steps.length - 1 ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>, document.body,
  );
}
