import { Request, Response, Router } from 'express';
import { getReviews, getReviewStats, getInstallations, prisma } from '../services/database';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Get all reviews with pagination
router.get('/reviews', optionalAuth, async (req: Request, res: Response) => {
  try {
    const repo = req.query.repo as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { reviews, total } = await getReviews(repo, limit, offset);

    res.json({
      reviews,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reviews.length < total,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch reviews', error as Error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get review statistics
router.get('/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const repo = req.query.repo as string | undefined;
    const stats = await getReviewStats(repo);

    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch stats', error as Error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get installations
router.get('/installations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const installations = await getInstallations();
    res.json(installations);
  } catch (error) {
    logger.error('Failed to fetch installations', error as Error);
    res.status(500).json({ error: 'Failed to fetch installations' });
  }
});

// Get single review
router.get('/reviews/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    logger.error('Failed to fetch review', error as Error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

export default router;
