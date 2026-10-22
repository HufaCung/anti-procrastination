import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Segmented } from './ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { schedule } from '../logic/schedule';
import { addDays, fmt, relDay, startOfDay } from '../logic/dates';

type When = 'auto' | 'today' | 'tomorrow' | 'none';

export function QuickTaskModal({ open, onClose, defaultProjectId }: { open: boolean; onClose: () => void; defaultProjectId?: string }) {
  const s = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [est, setEst] = useState(15);
  const [section, setSection] = useState('Inbox');
  const [when, setWhen] = useState<When>('auto');
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const projects = s.activeProjects;

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setError('');
    setWhen('auto');
    setSection('Inbox');
    setEst(s.data?.settings.defaultTaskMin ?? 15);
    setProjectId(defaultProjectId ?? projects[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sections = Array.from(new Set(['Inbox', ...s.tasksOf(projectId).map((t) => t.section)]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the task a short, verb-first title.');
      ref.current?.focus();
      return;
    }
    if (!projectId) return;
    const d = s.data!;
    const task = s.addTask({ projectId, title, estimateMin: est, section });
    let label = 'Not scheduled';
    if (when !== 'none') {
      const now = new Date();
      const opts = when === 'today' ? { onlyDay: now, ignoreDeadline: true } : when === 'tomorrow' ? { onlyDay: addDays(startOfDay(now), 1), ignoreDeadline: true } : {};
      const res = schedule([task], d.settings, [...d.tasks, task], d.projects, now, opts);
      const to = res.placements[0]?.to;
      if (to) {
        s.updateTask(task.id, { scheduledFor: to });
        const dt = new Date(to);
        label = `${relDay(dt, now)} at ${fmt.time(dt)}`;
      } else {
        label = when === 'auto' ? 'No free slot before the deadline' : `No free slot ${when}`;
      }
    }
    onClose();
    const p = projects.find((x) => x.id === projectId);
    toast({ tone: 'ok', title: `Added to ${p?.name ?? 'project'}`, body: label, action: { label: 'View', onClick: () => navigate(`/projects/${projectId}?task=${task.id}`) } });
  };

  return (
    <Modal open={open} onClose={onClose} title="New task" initialFocus={ref}>
      {projects.length === 0 ? (
        <div className="modal-body">
          <p className="muted" style={{ lineHeight: 1.5 }}>Tasks live inside projects. Create a project first, then add tasks to it.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => { onClose(); navigate('/projects?new=1'); }}>New project</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="qt-title">Task</label>
              <input id="qt-title" ref={ref} className={`input lg ${error ? 'err' : ''}`} value={title} placeholder="Add a 10–15 min task…" onChange={(e) => { setTitle(e.target.value); setError(''); }} aria-invalid={!!error} />
              {error && <span role="alert" className="err-text">{error}</span>}
            </div>
            <div className="row wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: '2 1 200px' }}>
                <label htmlFor="qt-project">Project</label>
                <select id="qt-project" className="select" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSection('Inbox'); }}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 110px' }}>
                <label htmlFor="qt-est">Estimate</label>
                <select id="qt-est" className="select" value={est} onChange={(e) => setEst(Number(e.target.value))}>
                  {[5, 10, 15, 20, 25, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="qt-section">Section</label>
              <select id="qt-section" className="select" value={section} onChange={(e) => setSection(e.target.value)}>
                {sections.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="field-label">Schedule</span>
              <Segmented label="Schedule" full value={when} onChange={setWhen} options={[{ value: 'auto', label: 'Auto' }, { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'none', label: 'Later' }]} />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add task</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
