import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { verifyJWT } from '../middleware/auth';

const router = Router({ mergeParams: true });

function toInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// GET /umkm/:id/comments
router.get('/', async (req, res) => {
  const umkmId = toInt(req.params.id);
  if (umkmId === null) return res.status(400).json({ error: 'Invalid umkm id' });

  const { data, error } = await supabase
    .from('Comments')
    .select('IDComments, user, umkm, content, rating')
    .eq('umkm', umkmId)
    .order('IDComments', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

// POST /umkm/:id/comments
router.post('/', verifyJWT, async (req, res) => {
  const umkmId = toInt(req.params.id);
  if (umkmId === null) return res.status(400).json({ error: 'Invalid umkm id' });

  const { content, rating } = req.body as {
    content?: string; rating?: number;
  };

  if (!content || typeof rating !== 'number') {
    return res.status(400).json({ error: 'content and rating are required' });
  }

  const { data, error } = await supabase
    .from('Comments')
    .insert([{ user: req.user!.id, umkm: umkmId, content, rating }])
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Update agregat rating pada tabel Umkm
  const { data: umkm, error: umkmErr } = await supabase
    .from('Umkm')
    .select('rating, total_rating')
    .eq('IDUmkm', umkmId)
    .single();
  if (umkmErr) return res.status(201).json({ data, warning: 'Failed to read Umkm aggregate' });

  const currentAvg = Number(umkm?.rating ?? 0);
  const currentCount = Number(umkm?.total_rating ?? 0);
  const newCount = currentCount + 1;
  const newAvg = ((currentAvg * currentCount) + rating) / newCount;

  const { error: updErr } = await supabase
    .from('Umkm')
    .update({ rating: newAvg, total_rating: newCount })
    .eq('IDUmkm', umkmId);

  if (updErr) return res.status(201).json({ data, warning: 'Failed to update Umkm rating' });
  return res.status(201).json({ data });
});

export default router;


