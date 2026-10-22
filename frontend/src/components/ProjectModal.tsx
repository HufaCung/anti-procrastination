import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Priority, Project } from '../data/types';
import { ConfirmModal, Modal, Segmented, TextField } from './ui';
import { PROJECT_COLORS } from '../data/colors';
import { pickColor, useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { addDays, dayKey } from '../logic/dates';

export function ProjectModal({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const s = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = !!project;
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [color, setColor] = useState(PROJECT_COLORS[1]);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirm, setConfirm] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (project) {
      setName(project.name);
      setDue(project.dueDate);
      setPriority(project.priority);
      setColor(project.color);
      setDescription(project.description ?? '');
    } else {
      setName('');
      setDue(dayKey(addDays(new Date(), 14)));
      setPriority('medium');
      setColor(pickColor(s.data?.projects ?? []));
      setDescription('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Give the project a name (2+ characters).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) errs.due = 'Pick a deadline.';
    else if (!editing && due < dayKey(new Date())) errs.due = 'The deadline can’t be in the past.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      (errs.name ? nameRef.current : document.getElementById('pm-due'))?.focus();
      return;
    }
    if (editing && project) {
      s.updateProject(project.id, { name: name.trim(), dueDate: due, priority, color, description: description.trim() || undefined });
      toast({ tone: 'ok', title: 'Project updated' });
      onClose();
      return;
    }
    const p = s.createProject({ name, dueDate: due, priority, color, description });
    onClose();
    toast({ tone: 'ok', title: `Created ${p.name}`, body: 'Add a few 10–15 minute tasks to get started.' });
    navigate(`/projects/${p.id}`);
  };

  return (
    <>
      <Modal
        open={open && !confirm}
        onClose={onClose}
        title={editing ? 'Edit project' : 'New project'}
        initialFocus={nameRef}
        width={500}
      >
        <form onSubmit={submit} noValidate>
          <div className="modal-body">
            <TextField label="Project name" value={name} onChange={(v) => { setName(v); setErrors((x) => ({ ...x, name: '' })); }} error={errors.name} placeholder="e.g. Final report for Data Structures" inputRef={nameRef} />
            <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="pm-due">Deadline</label>
                <input id="pm-due" type="date" className={`input lg ${errors.due ? 'err' : ''}`} value={due} onChange={(e) => { setDue(e.target.value); setErrors((x) => ({ ...x, due: '' })); }} aria-invalid={!!errors.due} />
                {errors.due && <span role="alert" className="err-text">{errors.due}</span>}
              </div>
              <div className="field" style={{ flex: '1 1 220px' }}>
                <span className="field-label" id="pm-prio">Priority</span>
                <Segmented label="Priority" full tall value={priority} onChange={setPriority} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
              </div>
            </div>
            <div className="field">
              <span className="field-label">Color</span>
              <div className="color-swatches" role="radiogroup" aria-label="Project color">
                {PROJECT_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Color ${c}`} className="swatch" style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="pm-desc">
                Notes <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea id="pm-desc" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, links, anything worth remembering" />
            </div>
          </div>
          <div className="modal-foot" style={{ justifyContent: editing ? 'space-between' : 'flex-end' }}>
            {editing && (
              <button type="button" className="btn btn-danger-outline" onClick={() => setConfirm(true)}>Delete project</button>
            )}
            <div className="row">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editing ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
      {project && (
        <ConfirmModal
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Delete this project?"
          body={<>“{project.name}” and its {s.tasksOf(project.id).length} tasks will be permanently removed. Focus time already logged stays in your stats.</>}
          confirmLabel="Delete project"
          onConfirm={() => {
            s.deleteProject(project.id);
            setConfirm(false);
            onClose();
            toast({ title: `Deleted ${project.name}` });
            navigate('/projects');
          }}
        />
      )}
    </>
  );
}
