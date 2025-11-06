import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase';
import categoriesRouter from './routes/categories';
import umkmRouter from './routes/umkm';
import commentsRouter from './routes/comments';
import authRouter from './routes/auth';
import { configureSecurity, errorHandler } from './middleware/security';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

configureSecurity(app);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Routes
app.use('/categories', categoriesRouter);
app.use('/umkm', umkmRouter);
app.use('/umkm/:id/comments', (req, res, next) => commentsRouter(req, res, next));
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);

// centralized error handler (last)
app.use(errorHandler);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
});


