import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { FileDiff, PRContext, ReviewIssue, WebhookPayload } from '../types';
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

export async function createRemediationPullRequest(
  octokit: Octokit,
  context: PRContext,
  issues: ReviewIssue[],
  files: FileDiff[]
): Promise<string | null> {
  if (issues.length === 0) return null;

  const maxIssues = issues.slice(0, 20);
  const branchName = `raptor/remediation-pr-${context.pullNumber}-${Date.now()}`;
  const baseBranch = context.baseBranch;
  const reportPath = `raptor/remediation/pr-${context.pullNumber}.md`;

  const report = [
    '# Raptor Automated Remediation Draft',
    '',
    `Source PR: #${context.pullNumber}`,
    `Repository: ${context.owner}/${context.repo}`,
    '',
    'This branch was generated automatically from AI review findings.',
    'Apply/adjust fixes below before merging.',
    '',
    '## Findings',
    ...maxIssues.map((issue, index) => [
      `### ${index + 1}. ${issue.title}`,
      `- Severity: ${issue.severity}`,
      `- Category: ${issue.category}`,
      `- Location: ${issue.file}:${issue.line}`,
      `- Description: ${issue.description}`,
      `- Suggested fix: ${issue.suggestion}`,
      '',
    ].join('\n'))
  ].join('\n');

  const safeFixes = issues
    .filter(issue => issue.file && issue.codeSnippet && issue.suggestion)
    .slice(0, 10);

  try {
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner: context.owner,
      repo: context.repo,
      ref: `heads/${baseBranch}`,
    });

    await octokit.rest.git.createRef({
      owner: context.owner,
      repo: context.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseRef.object.sha,
    });

    let sourceFilesPatched = 0;
    for (const issue of safeFixes) {
      const snippet = issue.codeSnippet;
      const suggestion = issue.suggestion;
      if (!snippet || !suggestion) continue;
      const file = files.find(f => f.filename === issue.file);
      if (!file || !file.patch) continue;

      try {
        const { data: contentRes } = await octokit.rest.repos.getContent({
          owner: context.owner,
          repo: context.repo,
          path: issue.file,
          ref: branchName,
        });

        if (!('content' in contentRes)) continue;
        const decoded = Buffer.from(contentRes.content, 'base64').toString('utf8');
        if (!decoded.includes(snippet)) continue;

        const updated = decoded.replace(snippet, suggestion);
        if (updated === decoded) continue;

        await octokit.rest.repos.createOrUpdateFileContents({
          owner: context.owner,
          repo: context.repo,
          path: issue.file,
          branch: branchName,
          message: `fix(raptor): apply safe autofix for ${issue.file}:${issue.line}`,
          content: Buffer.from(updated, 'utf8').toString('base64'),
          sha: contentRes.sha,
        });
        sourceFilesPatched += 1;
      } catch (error) {
        logger.warn('Safe autofix patch failed', {
          repo: `${context.owner}/${context.repo}`,
          pr: context.pullNumber,
          file: issue.file,
          error: (error as Error).message,
        });
      }
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: context.owner,
      repo: context.repo,
      path: reportPath,
      branch: branchName,
      message: `chore(raptor): add remediation draft for PR #${context.pullNumber}`,
      content: Buffer.from(`${report}\n\n## Autofix summary\n- Source files patched: ${sourceFilesPatched}\n`, 'utf8').toString('base64'),
    });

    const { data: pr } = await octokit.rest.pulls.create({
      owner: context.owner,
      repo: context.repo,
      title: `Raptor remediation draft for PR #${context.pullNumber}`,
      head: branchName,
      base: baseBranch,
      body: `Automated remediation draft generated from findings on #${context.pullNumber}.\n\nThis PR includes safe autofix commits when exact snippet replacement is possible, plus a structured fix plan for remaining items.`,
    });

    logger.info('Remediation PR created', {
      repo: `${context.owner}/${context.repo}`,
      sourcePr: context.pullNumber,
      remediationPr: pr.number,
    });

    return pr.html_url;
  } catch (error) {
    logger.warn('Failed to create remediation PR', {
      repo: `${context.owner}/${context.repo}`,
      pr: context.pullNumber,
      error: (error as Error).message,
    });
    return null;
  }
}
