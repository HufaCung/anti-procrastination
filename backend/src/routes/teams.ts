import { Router, type Response } from 'express';
import { teamsDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/async-handler.js';
import type { Team } from '../types.js';
import { randomUUID } from 'node:crypto';

export const teamsRouter = Router();
teamsRouter.use(authMiddleware);
teamsRouter.get('/', asyncHandler(async (req:AuthenticatedRequest,res:Response)=>{res.json({teams:await teamsDb.list(req.user!.id)});}));
teamsRouter.post('/', asyncHandler(async (req:AuthenticatedRequest,res:Response)=>{ const name=String(req.body.name||'').trim().slice(0,80); if(!name){res.status(400).json({error:'Team name is required'});return;} const now=new Date().toISOString(); const team:Team={id:`team_${randomUUID()}`,name,color:String(req.body.color||'#4f7d64'),ownerId:req.user!.id,createdAt:now,members:[],tasks:[]}; await teamsDb.create(team,req.user!.id);res.status(201).json({team}); }));
teamsRouter.post('/:id/members',asyncHandler(async(req:AuthenticatedRequest,res:Response)=>{const result=await teamsDb.addMember(String(req.params.id),req.user!.id,String(req.body.username||''));if(result==='missing'){res.status(404).json({error:'Không tìm thấy tài khoản'});return;}if(result==='forbidden'){res.status(403).json({error:'Chỉ chủ nhóm có thể mời thành viên'});return;}res.json({success:true});}));
teamsRouter.post('/:id/tasks',asyncHandler(async(req:AuthenticatedRequest,res:Response)=>{const title=String(req.body.title||'').trim().slice(0,160);if(!title){res.status(400).json({error:'Task title is required'});return;}const task={id:`tt_${randomUUID()}`,title,assigneeId:req.body.assigneeId?String(req.body.assigneeId):undefined,createdAt:new Date().toISOString()};if(!await teamsDb.addTask(String(req.params.id),req.user!.id,task)){res.status(403).json({error:'Not a team member'});return;}res.status(201).json({task});}));
teamsRouter.patch('/:id/tasks/:taskId',asyncHandler(async(req:AuthenticatedRequest,res:Response)=>{if(!await teamsDb.toggleTask(String(req.params.id),String(req.params.taskId),req.user!.id,!!req.body.done)){res.status(404).json({error:'Task not found'});return;}res.json({success:true});}));
teamsRouter.delete('/:id',asyncHandler(async(req:AuthenticatedRequest,res:Response)=>{if(!await teamsDb.remove(String(req.params.id),req.user!.id)){res.status(403).json({error:'Only the owner can delete this team'});return;}res.json({success:true});}));
