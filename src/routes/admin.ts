import { Router } from 'express';
import { verifyJWT, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { supabase } from '../lib/supabase';

const router = Router();

// PATCH /admin/users/:id/role { role: 'admin' | 'user' }
const UpdateRoleSchema = z.object({ role: z.enum(['admin', 'user']) });

router.patch('/users/:id/role', verifyJWT, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const parsed = UpdateRoleSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const role = parsed.data.role;

  // coba lowercase, bila constraint menolak, coba kapitalisasi
  let { data, error } = await supabase
    .from('User')
    .update({ role })
    .eq('iduser', id)
    .select('iduser, username, email, role')
    .single();

  if (error && (error as any).code === '23514') {
    const capitalized = role === 'admin' ? 'Admin' : 'User';
    const retry = await supabase
      .from('User')
      .update({ role: capitalized })
      .eq('iduser', id)
      .select('iduser, username, email, role')
      .single();
    data = retry.data as any;
    error = retry.error as any;
  }

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

export default router;


