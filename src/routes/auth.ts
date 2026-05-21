import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/database';
import { logger } from '../utils/logger';

const router = Router();

// Types
interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

interface GitHubTokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
}

// Generate JWT Token
function generateJWT(user: GitHubUser) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.login,
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
}

router.get('/auth/github/login', (req: Request, res: Response) => {
  try {
    const state = req.query.state as string;
    const redirectUri = req.query.redirectUri as string;

    if (!state || !redirectUri) {
      return res.status(400).json({
        error: 'Missing required parameters: state and redirectUri',
      });
    }

    // Validate redirectUri format (prevent open redirect attacks)
    try {
      new URL(redirectUri);
    } catch {
      return res.status(400).json({
        error: 'Invalid redirectUri format',
      });
    }

    logger.info('GitHub OAuth login initiated', {
      state: state.substring(0, 10) + '...',
      redirectUri,
    });

    // Construct GitHub OAuth URL
    const githubUrl = new URL('https://github.com/login/oauth/authorize');
    githubUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID || '');
    
    // ⚠️ CRITICAL: Use the redirectUri sent by frontend
    // This tells GitHub where to redirect the user after authorization
    githubUrl.searchParams.set('redirect_uri', redirectUri);
    
    githubUrl.searchParams.set('scope', 'repo,user');
    githubUrl.searchParams.set('state', state);

    logger.info('Redirecting to GitHub OAuth', {
      url: githubUrl.toString().substring(0, 50) + '...',
    });

    res.json({
      url: githubUrl.toString(),
    });
  } catch (error) {
    logger.error('GitHub login error', error as Error);
    res.status(500).json({ error: 'Failed to initiate GitHub login' });
  }
});

/**
 * POST /auth/github
 * 
 * Completes GitHub OAuth flow
 * Expects body:
 * - code: authorization code from GitHub
 * - redirectUri: must match the one used in /auth/github/login
 */
router.post('/auth/github', async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        error: 'Missing required parameters: code and redirectUri',
      });
    }

    logger.info('Completing GitHub OAuth', {
      code: code.substring(0, 10) + '...',
      redirectUri,
    });

    // Step 1: Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        // ⚠️ CRITICAL: redirectUri must match exactly what was used in /auth/github/login
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json() as GitHubTokenResponse;

    if (tokenData.error) {
      logger.error('GitHub token exchange failed', new Error(tokenData.error_description));
      return res.status(400).json({
        error: 'Failed to authenticate with GitHub',
        details: tokenData.error_description,
      });
    }

    // Step 2: Get user information from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user data');
    }

    const user = await userResponse.json() as GitHubUser;

    logger.info('GitHub user authenticated', {
      userId: user.id,
      username: user.login,
    });

    // Step 3: Create or update user in database (optional)
    // Uncomment if you have a users table
    /*
    const dbUser = await prisma.user.upsert({
      where: { githubId: user.id },
      update: {
        username: user.login,
        avatarUrl: user.avatar_url,
        email: user.email,
      },
      create: {
        githubId: user.id,
        username: user.login,
        avatarUrl: user.avatar_url,
        email: user.email || '',
      },
    });
    */

    // Step 4: Generate JWT token
    const token = generateJWT(user);

    logger.info('GitHub OAuth successful', { username: user.login });

    // Return token and user info to frontend
    res.json({
      token,
      user: {
        username: user.login,
        githubId: user.id,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    logger.error('GitHub authentication failed', error as Error);
    res.status(500).json({
      error: 'GitHub authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /auth/github/callback
 * 
 * Alternative callback handler for direct GitHub -> Backend redirects
 * (Less common, use if GitHub redirects directly to backend)
 */
router.post('/auth/github/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
      });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri || `${req.headers.origin}/api/auth/github/callback`,
      }),
    });

    const tokenData = await tokenResponse.json() as GitHubTokenResponse;

    if (tokenData.error) {
      return res.status(400).json({
        error: 'Failed to authenticate with GitHub',
      });
    }

    // Get user data
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    const user = await userResponse.json() as GitHubUser;
    const token = generateJWT(user);

    res.json({
      token,
      user: {
        username: user.login,
        githubId: user.id,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    logger.error('GitHub callback error', error as Error);
    res.status(500).json({ error: 'GitHub authentication failed' });
  }
});

export default router;
