import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Page } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { api } from '../data/api';
import type { Team } from '../data/types';
import { useStore } from '../store/AppStore';
import { useLanguage } from '../i18n/LanguageContext';

export function TeamsPage() {
  const { language } = useLanguage();
  const s = useStore();
  const vi = language === 'vi';
  const [teams,setTeams]=useState<Team[]>([]); const [selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true); const [creating,setCreating]=useState(false); const [name,setName]=useState('');
  const [invite,setInvite]=useState(''); const [task,setTask]=useState(''); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  const current=useMemo(()=>teams.find(t=>t.id===selected)??teams[0],[teams,selected]);
  const reload=async()=>{const r=await api.getTeams();setTeams(r?.teams??[]);if(!selected&&r?.teams[0])setSelected(r.teams[0].id);setLoading(false);};
  useEffect(()=>{void reload();},[]);
  const submitTeam=async(e:FormEvent)=>{e.preventDefault();if(!name.trim())return;setBusy(true);const r=await api.createTeam(name.trim());setBusy(false);if(r){setName('');setCreating(false);await reload();setSelected(r.team.id);}};
  const addMember=async(e:FormEvent)=>{e.preventDefault();if(!current||!invite.trim())return;setBusy(true);const r=await api.addTeamMember(current.id,invite.trim());setBusy(false);setNotice(r?(vi?'Đã thêm thành viên.':'Member added.'):(vi?'Không tìm thấy tài khoản hoặc bạn không có quyền mời.':'Account not found or you cannot invite members.'));if(r){setInvite('');await reload();}};
  const addTask=async(e:FormEvent)=>{e.preventDefault();if(!current||!task.trim())return;setBusy(true);const r=await api.addTeamTask(current.id,task.trim());setBusy(false);if(r){setTask('');await reload();}};
  const toggle=async(id:string,done:boolean)=>{if(!current)return;await api.toggleTeamTask(current.id,id,done);await reload();};
  return <Page label={vi?'Nhóm':'Teams'} className="teams-page">
    <div className="page-head"><div><div className="eyebrow">{vi?'CỘNG TÁC':'COLLABORATION'}</div><h1 className="page-title">{vi?'Nhóm':'Teams'}</h1><p className="muted">{vi?'Chia sẻ công việc và cùng nhau hoàn thành dự án.':'Share work and move projects forward together.'}</p></div><button className="btn btn-primary" onClick={()=>setCreating(true)}><Icon name="plus"/> {vi?'Thêm nhóm':'Add a team'}</button></div>
    {creating&&<form className="team-create card" onSubmit={submitTeam}><div><strong>{vi?'Tạo nhóm mới':'Create a new team'}</strong><p className="muted">{vi?'Đặt tên ngắn gọn, ví dụ “Nhóm đồ án”.':'Use a short name, such as “Course project”.'}</p></div><input autoFocus className="input" value={name} onChange={e=>setName(e.target.value)} placeholder={vi?'Tên nhóm':'Team name'}/><button className="btn btn-primary" disabled={busy}>{vi?'Tạo nhóm':'Create team'}</button><button type="button" className="btn btn-secondary" onClick={()=>setCreating(false)}>{vi?'Hủy':'Cancel'}</button></form>}
    {loading?<div className="empty-row">{vi?'Đang tải nhóm...':'Loading teams...'}</div>:teams.length===0?<div className="team-empty card"><div className="team-empty-icon"><Icon name="users" size={28}/></div><h2>{vi?'Làm việc cùng nhau':'Work better together'}</h2><p>{vi?'Tạo nhóm, mời bạn học bằng tên đăng nhập và theo dõi danh sách công việc chung.':'Create a team, invite people by username, and keep a shared task list.'}</p><button className="btn btn-primary" onClick={()=>setCreating(true)}><Icon name="plus"/> {vi?'Thêm nhóm':'Add a team'}</button></div>:
    <div className="team-layout"><aside className="team-list card"><div className="side-head"><span>{vi?'NHÓM CỦA TÔI':'MY TEAMS'}</span><span>{teams.length}</span></div>{teams.map(team=><button key={team.id} className={`team-picker ${current?.id===team.id?'active':''}`} onClick={()=>setSelected(team.id)}><span className="team-mark" style={{background:team.color}}>{team.name[0]?.toUpperCase()}</span><span><strong>{team.name}</strong><small>{team.members.length} {vi?'thành viên':'members'}</small></span></button>)}</aside>
    {current&&<section className="team-work"><div className="card team-hero"><div className="team-mark large" style={{background:current.color}}>{current.name[0]?.toUpperCase()}</div><div><h2>{current.name}</h2><p className="muted">{current.members.length} {vi?'thành viên':'members'} · {current.tasks.filter(t=>!t.done).length} {vi?'việc cần làm':'open tasks'}</p></div></div>
      <div className="team-grid"><div className="card team-panel"><div className="team-panel-head"><h3>{vi?'Công việc chung':'Shared tasks'}</h3><span className="pill todo">{current.tasks.filter(t=>!t.done).length}</span></div><form className="team-inline" onSubmit={addTask}><input className="input" value={task} onChange={e=>setTask(e.target.value)} placeholder={vi?'Thêm việc cho nhóm...':'Add a team task...'}/><button className="btn btn-primary" disabled={busy}><Icon name="plus"/></button></form><div className="team-tasks">{current.tasks.length===0?<p className="muted">{vi?'Chưa có công việc. Hãy thêm việc đầu tiên.':'No tasks yet. Add the first one.'}</p>:current.tasks.map(t=><label key={t.id} className={`team-task ${t.done?'done':''}`}><input type="checkbox" checked={t.done} onChange={()=>void toggle(t.id,!t.done)}/><span>{t.title}</span></label>)}</div></div>
      <div className="card team-panel"><div className="team-panel-head"><h3>{vi?'Thành viên':'Members'}</h3></div>{current.members.map(m=><div className="member-row" key={m.userId}><span className="avatar">{m.name[0]?.toUpperCase()}</span><span><strong>{m.name}</strong><small>@{m.username}</small></span><span className="pill">{m.role==='owner'?(vi?'Chủ nhóm':'Owner'):(vi?'Thành viên':'Member')}</span></div>)}{current.ownerId===s.user?.id&&<form className="invite-box" onSubmit={addMember}><label>{vi?'Mời bằng tên đăng nhập':'Invite by username'}</label><div className="team-inline"><input className="input" value={invite} onChange={e=>setInvite(e.target.value)} placeholder="username"/><button className="btn btn-secondary" disabled={busy}>{vi?'Mời':'Invite'}</button></div>{notice&&<small className="muted">{notice}</small>}</form>}</div></div>
    </section>}</div>}
  </Page>;
}
