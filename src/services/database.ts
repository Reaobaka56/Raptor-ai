import { PrismaClient } from '@prisma/client';
import { ReviewIssue, ReviewResult, PRContext } from '../types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function saveReview(
  context: PRContext,
  result: ReviewResult,
  reviewTimeMs: number
) {
  try {
    const review = await prisma.review.create({
      data: {
        githubRepo: `${context.owner}/${context.repo}`,
        prNumber: context.pullNumber,
        prTitle: context.title,
        prUrl: `https://github.com/${context.owner}/${context.repo}/pull/${context.pullNumber}`,
        issues: result.issues as any,
        summary: result.summary,
        status: 'completed',
        reviewTimeMs,
      },
    });

    logger.info('Review saved to database', {
      reviewId: review.id,
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber
    });

    return review;
  } catch (error) {
    logger.error('Failed to save review', error as Error);
    throw error;
  }
}

export async function getReviews(
  repo?: string,
  limit: number = 50,
  offset: number = 0
) {
  const where = repo ? { githubRepo: repo } : {};

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, total };
}

export async function getReviewStats(repo?: string) {
  const where = repo ? { githubRepo: repo } : {};

  const reviews = await prisma.review.findMany({
    where,
    select: {
      issues: true,
      createdAt: true,
      reviewTimeMs: true,
    },
  });

  const stats = {
    totalReviews: reviews.length,
    totalIssues: 0,
    avgReviewTime: 0,
    issuesBySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    issuesByCategory: {
      security: 0,
      performance: 0,
      quality: 0,
      design: 0,
    },
    reviewsOverTime: [] as { date: string; count: number; issues: number }[],
  };

  let totalReviewTime = 0;
  const timeMap = new Map<string, { count: number; issues: number }>();
  const severities = new Set<ReviewIssue['severity']>(['critical', 'high', 'medium', 'low']);
  const categories = new Set<ReviewIssue['category']>(['security', 'performance', 'quality', 'design']);

  for (const review of reviews) {
    const issues = (review.issues as any[]) || [];
    stats.totalIssues += issues.length;
    totalReviewTime += review.reviewTimeMs || 0;

    for (const issue of issues) {
      if (severities.has(issue.severity)) stats.issuesBySeverity[issue.severity as ReviewIssue['severity']]++;
      if (categories.has(issue.category)) stats.issuesByCategory[issue.category as ReviewIssue['category']]++;
    }

    const date = review.createdAt.toISOString().split('T')[0];
    const existing = timeMap.get(date) || { count: 0, issues: 0 };
    existing.count++;
    existing.issues += issues.length;
    timeMap.set(date, existing);
  }

  stats.avgReviewTime = reviews.length > 0 ? Math.round(totalReviewTime / reviews.length) : 0;

  stats.reviewsOverTime = Array.from(timeMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return stats;
}

export async function saveInstallation(
  installationId: number,
  accountLogin: string,
  accountType: string
) {
  return prisma.installation.upsert({
    where: { installationId },
    update: {
      accountLogin,
      accountType,
      isActive: true,
    },
    create: {
      installationId,
      accountLogin,
      accountType,
      isActive: true,
    },
  });
}

export async function deactivateInstallation(installationId: number) {
  return prisma.installation.update({
    where: { installationId },
    data: { isActive: false },
  });
}

export async function getInstallations() {
  return prisma.installation.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export { prisma };
