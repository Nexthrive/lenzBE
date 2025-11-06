import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { verifyJWT, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

function toInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// GET /umkm - list with filters
router.get('/', async (req, res) => {
  const q = (req.query.q as string) || '';
  const location = (req.query.location as string) || '';
  const categoryId = req.query.categoryId as string | undefined;
  const sort = (req.query.sort as string) || 'recommendation';
  const limit = Math.min(Math.max(toInt(req.query.limit, 20), 1), 100);
  const page = Math.max(toInt(req.query.page, 1), 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('Umkm').select('*', { count: 'exact' }).eq('is_active', true);

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (location) {
    query = query.ilike('location', `%${location}%`);
  }
  if (categoryId) {
    query = query.eq('categories', Number(categoryId));
  }

  if (sort === 'rating') {
    query = query.order('rating', { ascending: false });
  } else {
    // recommendation: rating desc then total_rating desc
    query = query.order('rating', { ascending: false }).order('total_rating', { ascending: false });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data, pagination: { page, limit, total: count ?? 0 } });
});

// GET /umkm/:id - detail with basic aggregates
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const { data: umkm, error } = await supabase
    .from('Umkm')
    .select('*')
    .eq('IDUmkm', id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!umkm) return res.status(404).json({ error: 'Not found' });

  const [{ data: comments, error: commentsError }, { data: category, error: categoryError }] = await Promise.all([
    supabase.from('Comments').select('IDComments, user, content, rating').eq('umkm', id).order('IDComments', { ascending: false }).limit(5),
    supabase.from('Categories').select('IDCategories, name').eq('IDCategories', umkm.categories).single(),
  ]);

  if (commentsError) return res.status(500).json({ error: commentsError.message });
  if (categoryError) return res.status(500).json({ error: categoryError.message });

  return res.json({ data: { ...umkm, category, recent_comments: comments } });
});

// POST /umkm - create by user (inactive)
const CreateUmkmSchema = z.object({
  name: z.string().min(1).max(128),
  location: z.string().min(1).max(128),
  description: z.string().max(1000).optional().default(''),
  categories: z.number().int().positive(),
  photo: z.string().url().optional().nullable(),
});

router.post('/', verifyJWT, requireRole('user'), async (req, res) => {
  const parse = CreateUmkmSchema.safeParse(req.body ?? {});
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload', details: parse.error.flatten() });
  const { name, location, description, categories, photo } = parse.data;
  // Pastikan kategori ada
  const { data: cat, error: catErr } = await supabase
    .from('Categories')
    .select('IDCategories')
    .eq('IDCategories', Number(categories))
    .single();
  if (catErr || !cat) return res.status(400).json({ error: 'Invalid categories: not found' });
  const userId = req.user!.id;
  const { data, error } = await supabase
    .from('Umkm')
    .insert([{ name, location, description, categories: Number(categories), photo: photo ?? null, user_id: userId, rating: 0, total_rating: 0, is_active: false }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
});

// ADMIN: list pending items
router.get('/admin/pending', verifyJWT, requireRole('admin'), async (_req, res) => {
  const { data, error } = await supabase
    .from('Umkm')
    .select('*')
    .eq('is_active', false)
    .order('IDUmkm', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

// ADMIN: activate
router.post('/:id/activate', verifyJWT, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { data, error } = await supabase
    .from('Umkm')
    .update({ is_active: true })
    .eq('IDUmkm', id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

export default router;


