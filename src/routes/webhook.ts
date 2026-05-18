import { Request, Response, Router } from 'express';
import { Webhooks } from '@octokit/webhooks';
import { logger } from '../utils/logger';
import { analyzeCode } from '../services/claude';
import {
  extractPRContext,
  fetchPRDiffs,
  getInstallationOctokit,
  postReviewComment,
} from '../services/github';
import { saveReview, saveInstallation, deactivateInstallation } from '../services/database';
import { buildCommentBody } from '../utils/prompts';
import { WebhookPayload } from '../types';

const router = Router();

// Initialize webhook handler with secret
const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET || '',
});

// Handle pull request events
webhooks.on('pull_request.opened', async ({ payload }) => {
  await handlePullRequest(payload as WebhookPayload);
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  await handlePullRequest(payload as WebhookPayload);
});

// Handle installation events
webhooks.on('installation.created', async ({ payload }) => {
  try {
    await saveInstallation(
      payload.installation.id,
      payload.installation.account.login,
      payload.installation.account.type
    );
    logger.info('Installation created', {
      installationId: payload.installation.id,
      account: payload.installation.account.login,
    });
  } catch (error) {
    logger.error('Failed to save installation', error as Error);
  }
});

webhooks.on('installation.deleted', async ({ payload }) => {
  try {
    await deactivateInstallation(payload.installation.id);
    logger.info('Installation deleted', {
      installationId: payload.installation.id,
    });
  } catch (error) {
    logger.error('Failed to deactivate installation', error as Error);
  }
});

async function handlePullRequest(payload: WebhookPayload) {
  const startTime = Date.now();

  try {
    const context = extractPRContext(payload);
    const installationId = payload.installation?.id;

    if (!installationId) {
      logger.warn('No installation ID found in webhook payload');
      return;
    }

    logger.info('Processing PR webhook', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber,
      action: payload.action,
    });

    // Get authenticated octokit for this installation
    const octokit = await getInstallationOctokit(installationId);

    // Fetch PR diffs
    const files = await fetchPRDiffs(octokit, context);

    if (files.length === 0) {
      logger.info('No files to review', {
        repo: `${context.owner}/${context.repo}`,
        pr: context.pullNumber,
      });
      return;
    }

    // Analyze code with Claude
    const result = await analyzeCode(files, context);

    // Build and post comment
    const commentBody = buildCommentBody(result);
    await postReviewComment(octokit, context, commentBody);

    // Save review to database
    const reviewTime = Date.now() - startTime;
    await saveReview(context, result, reviewTime);

    logger.info('PR review completed', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber,
      issuesFound: result.issues.length,
      reviewTimeMs: reviewTime,
    });

  } catch (error) {
    logger.error('Failed to process PR webhook', error as Error, {
      pr: payload.pull_request?.number,
      repo: payload.repository?.full_name,
    });
  }
}

// Express route to handle GitHub webhooks
router.post('/github', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const body = JSON.stringify(req.body);

    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    const isValid = await webhooks.verify(body, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook asynchronously
    await webhooks.receive({
      id: req.headers['x-github-delivery'] as string,
      name: req.headers['x-github-event'] as any,
      payload: req.body,
    });

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
