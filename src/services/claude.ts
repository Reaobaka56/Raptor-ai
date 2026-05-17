import Anthropic from '@anthropic-ai/sdk';
import { ReviewResult, FileDiff, PRContext } from '../types';
import { buildReviewPrompt } from '../utils/prompts';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeCode(
  files: FileDiff[],
  context: PRContext
): Promise<ReviewResult> {
  const startTime = Date.now();

  try {
    // Filter out large files and binary files
    const reviewableFiles = files.filter(file => 
      file.patch && 
      file.patch.length < 10000 && 
      !file.filename.match(/\.(jpg|jpeg|png|gif|pdf|zip|tar|gz|lock)$/i)
    );

    if (reviewableFiles.length === 0) {
      return {
        issues: [],
        summary: 'No reviewable code changes found in this PR.',
        stats: { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
      };
    }

    // If too many files, prioritize modified files over additions
    const prioritizedFiles = reviewableFiles
      .sort((a, b) => {
        if (a.status === 'modified' && b.status !== 'modified') return -1;
        if (a.status !== 'modified' && b.status === 'modified') return 1;
        return b.additions + b.deletions - (a.additions + a.deletions);
      })
      .slice(0, 10); // Limit to 10 files per review

    const prompt = buildReviewPrompt(prioritizedFiles, context);

    logger.info('Sending code to Claude for analysis', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber,
      filesCount: prioritizedFiles.length
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.1,
      system: 'You are an expert code reviewer. You analyze code changes and identify security vulnerabilities, performance issues, code quality problems, and design anti-patterns. You respond ONLY with valid JSON.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]) as ReviewResult;

    // Validate and normalize result
    const validatedResult: ReviewResult = {
      issues: (result.issues || []).map(issue => ({
        ...issue,
        severity: ['critical', 'high', 'medium', 'low'].includes(issue.severity) 
          ? issue.severity 
          : 'medium',
        category: ['security', 'performance', 'quality', 'design'].includes(issue.category)
          ? issue.category
          : 'quality'
      })),
      summary: result.summary || 'Code review completed.',
      stats: result.stats || {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      }
    };

    // Recalculate stats from issues
    validatedResult.stats = validatedResult.issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      acc.total += 1;
      return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0, total: 0 });

    const reviewTime = Date.now() - startTime;
    logger.info('Code analysis completed', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber,
      issuesFound: validatedResult.issues.length,
      reviewTimeMs: reviewTime
    });

    return validatedResult;

  } catch (error) {
    logger.error('Code analysis failed', error as Error, {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber
    });

    // Return empty result on failure so we don't block PR
    return {
      issues: [],
      summary: 'AI code review encountered an error. Please proceed with manual review.',
      stats: { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    };
  }
}
