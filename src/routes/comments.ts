import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { verifyJWT } from '../middleware/auth';
import { Request } from 'express';

declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    id: string;
  }
}

const router = Router<{ id: string }>();

function toInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// GET /umkm/:id/comments
router.get('/', async (req: Request<{ id: string }>, res) => {
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
router.post('/', verifyJWT, async (req: Request<{ id: string }>, res) => {
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
    .insert([{ user: req.user!.id, umkm: umkmId, content, rating }]);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
});

router.use((req, res, next) => {
  if (!req.params.id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }
  next();
});

export default router;


