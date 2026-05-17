import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { FileDiff, PRContext, WebhookPayload } from '../types';
import { logger } from '../utils/logger';

let appOctokit: Octokit | null = null;

function getAppOctokit(): Octokit {
  if (!appOctokit) {
    const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');

    appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: privateKey!,
      },
    });
  }
  return appOctokit;
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const app = getAppOctokit();

  const { data } = await app.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
  });

  return data.token;
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const token = await getInstallationToken(installationId);
  return new Octokit({ auth: token });
}

export function extractPRContext(payload: WebhookPayload): PRContext {
  const { pull_request, repository } = payload;

  return {
    owner: repository.owner.login,
    repo: repository.full_name.split('/')[1],
    pullNumber: pull_request.number,
    title: pull_request.title,
    description: pull_request.body || '',
    author: pull_request.user.login,
    baseBranch: pull_request.base.ref,
    headBranch: pull_request.head.ref,
  };
}

export async function fetchPRDiffs(
  octokit: Octokit,
  context: PRContext
): Promise<FileDiff[]> {
  try {
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: context.owner,
      repo: context.repo,
      pull_number: context.pullNumber,
    });

    return files.map(file => ({
      filename: file.filename,
      status: file.status as 'added' | 'modified' | 'removed',
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch || '',
    }));
  } catch (error) {
    logger.error('Failed to fetch PR diffs', error as Error, {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber
    });
    throw error;
  }
}

export async function postReviewComment(
  octokit: Octokit,
  context: PRContext,
  body: string
): Promise<void> {
  try {
    await octokit.rest.issues.createComment({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.pullNumber,
      body,
    });

    logger.info('Review comment posted', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber
    });
  } catch (error) {
    logger.error('Failed to post review comment', error as Error, {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber
    });
    throw error;
  }
}

export async function postInlineComment(
  octokit: Octokit,
  context: PRContext,
  file: string,
  line: number,
  body: string
): Promise<void> {
  try {
    await octokit.rest.pulls.createReview({
      owner: context.owner,
      repo: context.repo,
      pull_number: context.pullNumber,
      body: '',
      event: 'COMMENT',
      comments: [
        {
          path: file,
          line: line,
          body,
        },
      ],
    });
  } catch (error) {
    logger.warn('Failed to post inline comment', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber,
      file,
      line,
      error: (error as Error).message
    });
  }
}
