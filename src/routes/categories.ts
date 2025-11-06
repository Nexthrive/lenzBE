import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { verifyJWT, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// GET /categories - list all categories
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('Categories')
    .select('IDCategories, name')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

export default router;

// POST /categories - create category (admin only)
const CreateCategorySchema = z.object({ name: z.string().min(1).max(64) });

router.post('/', verifyJWT, requireRole('admin'), async (req, res) => {
  const parsed = CreateCategorySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const { name } = parsed.data;
  const { data: existing, error: checkErr } = await supabase
    .from('Categories')
    .select('IDCategories')
    .eq('name', name)
    .limit(1);
  if (checkErr) return res.status(500).json({ error: checkErr.message });
  if (existing && existing.length > 0) return res.status(409).json({ error: 'Category already exists' });

  const { data, error } = await supabase
    .from('Categories')
    .insert([{ name }])
    .select('IDCategories, name')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
});


