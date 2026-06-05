import { createAuthClient } from "better-auth/react";

// Initialize the auth client for the frontend
export const authClient = createAuthClient();

// Export signIn methods for convenience
export const { signIn } = authClient;
