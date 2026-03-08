import type { PullRequest, PRFile, PRComment, PRReviewComment, PRReview, PRContext } from '../types';

export const dummyPR: PullRequest = {
  id: 1,
  number: 42,
  title: 'feat: Add JWT authentication and user session management',
  body: `## Summary

This PR implements JWT-based authentication for the application, including:

- User login/logout endpoints
- JWT token generation and validation
- Refresh token support
- Auth middleware for protected routes
- Session management

## Changes

- Added \`src/auth/\` module with login, logout, and token refresh
- Added \`src/middleware/auth.ts\` for route protection
- Updated \`src/models/user.ts\` to include password hashing
- Added comprehensive tests for all auth flows

## Testing

All existing tests pass. New tests added:
- Unit tests for JWT utilities
- Integration tests for auth endpoints
- E2E tests for login flow

## Security Considerations

- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Tokens stored in httpOnly cookies

Closes #38`,
  state: 'open',
  merged: false,
  merged_at: null,
  user: {
    login: 'alice-dev',
    avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    html_url: 'https://github.com/alice-dev',
  },
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T16:30:00Z',
  head: {
    ref: 'feature/jwt-auth',
    sha: 'abc123def456',
    repo: {
      full_name: 'example-org/my-app',
    },
  },
  base: {
    ref: 'main',
    sha: 'def456abc123',
    repo: {
      full_name: 'example-org/my-app',
    },
  },
  url: 'https://api.github.com/repos/example-org/my-app/pulls/42',
  html_url: 'https://github.com/example-org/my-app/pull/42',
  diff_url: 'https://github.com/example-org/my-app/pull/42.diff',
  additions: 287,
  deletions: 45,
  changed_files: 8,
  comments: 3,
  review_comments: 5,
  commits: 4,
  labels: [
    { id: 1, name: 'feature', color: '0075ca' },
    { id: 2, name: 'security', color: 'e4e669' },
  ],
  requested_reviewers: [
    {
      login: 'bob-reviewer',
      avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
      html_url: 'https://github.com/bob-reviewer',
    },
  ],
};

export const dummyFiles: PRFile[] = [
  {
    sha: 'aaa111',
    filename: 'src/auth/index.ts',
    status: 'added',
    additions: 5,
    deletions: 0,
    changes: 5,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/src/auth/index.ts',
    patch: `@@ -0,0 +1,5 @@
+export { login, logout } from './login';
+export { refreshToken } from './refresh';
+export { generateToken, verifyToken } from './jwt';
+export { hashPassword, comparePassword } from './password';
+export type { AuthPayload, TokenPair } from './types';`,
  },
  {
    sha: 'bbb222',
    filename: 'src/auth/login.ts',
    status: 'added',
    additions: 68,
    deletions: 0,
    changes: 68,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/src/auth/login.ts',
    patch: `@@ -0,0 +1,68 @@
+import { User } from '../models/user';
+import { generateToken } from './jwt';
+import { comparePassword } from './password';
+import type { TokenPair } from './types';
+
+export interface LoginCredentials {
+  email: string;
+  password: string;
+}
+
+export interface LoginResult {
+  user: {
+    id: string;
+    email: string;
+    name: string;
+  };
+  tokens: TokenPair;
+}
+
+export async function login(credentials: LoginCredentials): Promise<LoginResult> {
+  const { email, password } = credentials;
+
+  // Find user by email
+  const user = await User.findOne({ email: email.toLowerCase() });
+  if (!user) {
+    throw new Error('Invalid credentials');
+  }
+
+  // Verify password
+  const isValid = await comparePassword(password, user.passwordHash);
+  if (!isValid) {
+    throw new Error('Invalid credentials');
+  }
+
+  // Generate token pair
+  const tokens = await generateToken({
+    userId: user.id,
+    email: user.email,
+    role: user.role,
+  });
+
+  return {
+    user: {
+      id: user.id,
+      email: user.email,
+      name: user.name,
+    },
+    tokens,
+  };
+}
+
+export async function logout(userId: string, refreshToken: string): Promise<void> {
+  // Invalidate refresh token
+  await User.updateOne(
+    { _id: userId },
+    { $pull: { refreshTokens: refreshToken } }
+  );
+}`,
  },
  {
    sha: 'ccc333',
    filename: 'src/auth/jwt.ts',
    status: 'added',
    additions: 52,
    deletions: 0,
    changes: 52,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/src/auth/jwt.ts',
    patch: `@@ -0,0 +1,52 @@
+import jwt from 'jsonwebtoken';
+import { randomBytes } from 'crypto';
+import type { AuthPayload, TokenPair } from './types';
+
+const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
+const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;
+const ACCESS_TOKEN_EXPIRY = '15m';
+const REFRESH_TOKEN_EXPIRY = '7d';
+
+export async function generateToken(payload: AuthPayload): Promise<TokenPair> {
+  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
+    expiresIn: ACCESS_TOKEN_EXPIRY,
+  });
+
+  const refreshToken = jwt.sign(
+    { ...payload, jti: randomBytes(16).toString('hex') },
+    REFRESH_TOKEN_SECRET,
+    { expiresIn: REFRESH_TOKEN_EXPIRY }
+  );
+
+  return { accessToken, refreshToken };
+}
+
+export function verifyToken(token: string, type: 'access' | 'refresh'): AuthPayload {
+  const secret = type === 'access' ? ACCESS_TOKEN_SECRET : REFRESH_TOKEN_SECRET;
+  try {
+    return jwt.verify(token, secret) as AuthPayload;
+  } catch (err) {
+    if (err instanceof jwt.TokenExpiredError) {
+      throw new Error('Token expired');
+    }
+    throw new Error('Invalid token');
+  }
+}`,
  },
  {
    sha: 'ddd444',
    filename: 'src/middleware/auth.ts',
    status: 'modified',
    additions: 35,
    deletions: 12,
    changes: 47,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/src/middleware/auth.ts',
    patch: `@@ -1,20 +1,43 @@
-import { Request, Response, NextFunction } from 'express';
+import { Request, Response, NextFunction } from 'express';
+import { verifyToken } from '../auth/jwt';
+import type { AuthPayload } from '../auth/types';
 
-// TODO: Implement proper auth
-export function authMiddleware(req: Request, res: Response, next: NextFunction) {
-  const token = req.headers.authorization;
-  if (!token) {
-    return res.status(401).json({ error: 'Unauthorized' });
-  }
-  // Placeholder - not secure!
-  if (token === 'secret') {
-    next();
-  } else {
-    res.status(401).json({ error: 'Invalid token' });
-  }
+declare global {
+  namespace Express {
+    interface Request {
+      user?: AuthPayload;
+    }
+  }
 }
+
+export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
+  const authHeader = req.headers.authorization;
+
+  if (!authHeader || !authHeader.startsWith('Bearer ')) {
+    res.status(401).json({ error: 'No token provided' });
+    return;
+  }
+
+  const token = authHeader.substring(7);
+
+  try {
+    const payload = verifyToken(token, 'access');
+    req.user = payload;
+    next();
+  } catch (err) {
+    const message = err instanceof Error ? err.message : 'Invalid token';
+    res.status(401).json({ error: message });
+  }
+}`,
  },
  {
    sha: 'eee555',
    filename: 'src/models/user.ts',
    status: 'modified',
    additions: 28,
    deletions: 8,
    changes: 36,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/src/models/user.ts',
    patch: `@@ -1,15 +1,35 @@
 import mongoose, { Schema, Document } from 'mongoose';
+import { hashPassword } from '../auth/password';
 
 export interface IUser extends Document {
   email: string;
   name: string;
-  password: string;
+  passwordHash: string;
+  role: 'user' | 'admin';
+  refreshTokens: string[];
   createdAt: Date;
+  updatedAt: Date;
 }
 
 const UserSchema = new Schema<IUser>({
   email: { type: String, required: true, unique: true, lowercase: true },
   name: { type: String, required: true },
-  password: { type: String, required: true },
-  createdAt: { type: Date, default: Date.now },
-});
+  passwordHash: { type: String, required: true },
+  role: { type: String, enum: ['user', 'admin'], default: 'user' },
+  refreshTokens: [{ type: String }],
+}, { timestamps: true });
+
+// Hash password before saving
+UserSchema.pre('save', async function(next) {
+  if (this.isModified('passwordHash')) {
+    this.passwordHash = await hashPassword(this.passwordHash);
+  }
+  next();
+});
 
 export const User = mongoose.model<IUser>('User', UserSchema);`,
  },
  {
    sha: 'fff666',
    filename: 'src/auth/password.ts',
    status: 'added',
    additions: 18,
    deletions: 0,
    changes: 18,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/src/auth/password.ts',
    patch: `@@ -0,0 +1,18 @@
+import bcrypt from 'bcrypt';
+
+const SALT_ROUNDS = 12;
+
+export async function hashPassword(password: string): Promise<string> {
+  return bcrypt.hash(password, SALT_ROUNDS);
+}
+
+export async function comparePassword(
+  password: string,
+  hash: string
+): Promise<boolean> {
+  return bcrypt.compare(password, hash);
+}`,
  },
  {
    sha: 'ggg777',
    filename: 'tests/auth.test.ts',
    status: 'added',
    additions: 81,
    deletions: 0,
    changes: 81,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/tests/auth.test.ts',
    patch: `@@ -0,0 +1,81 @@
+import { describe, it, expect, beforeEach, vi } from 'vitest';
+import { login, logout } from '../src/auth/login';
+import { generateToken, verifyToken } from '../src/auth/jwt';
+import { User } from '../src/models/user';
+
+vi.mock('../src/models/user');
+
+describe('Authentication', () => {
+  describe('login', () => {
+    it('should return tokens for valid credentials', async () => {
+      const mockUser = {
+        id: 'user123',
+        email: 'test@example.com',
+        name: 'Test User',
+        role: 'user',
+        passwordHash: '$2b$12$...',
+      };
+
+      vi.mocked(User.findOne).mockResolvedValue(mockUser);
+
+      const result = await login({
+        email: 'test@example.com',
+        password: 'correctpassword',
+      });
+
+      expect(result.user.email).toBe('test@example.com');
+      expect(result.tokens.accessToken).toBeDefined();
+      expect(result.tokens.refreshToken).toBeDefined();
+    });
+
+    it('should throw for invalid email', async () => {
+      vi.mocked(User.findOne).mockResolvedValue(null);
+
+      await expect(
+        login({ email: 'wrong@example.com', password: 'password' })
+      ).rejects.toThrow('Invalid credentials');
+    });
+  });
+
+  describe('JWT', () => {
+    it('should generate and verify access tokens', async () => {
+      const payload = { userId: 'user123', email: 'test@example.com', role: 'user' as const };
+      const tokens = await generateToken(payload);
+
+      const verified = verifyToken(tokens.accessToken, 'access');
+      expect(verified.userId).toBe(payload.userId);
+      expect(verified.email).toBe(payload.email);
+    });
+
+    it('should throw for expired tokens', () => {
+      const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid';
+      expect(() => verifyToken(expiredToken, 'access')).toThrow();
+    });
+  });
+});`,
  },
  {
    sha: 'hhh888',
    filename: 'package.json',
    status: 'modified',
    additions: 4,
    deletions: 0,
    changes: 4,
    contents_url: 'https://api.github.com/repos/example-org/my-app/contents/package.json',
    patch: `@@ -10,6 +10,10 @@
   "dependencies": {
     "express": "^4.18.2",
+    "bcrypt": "^5.1.1",
+    "jsonwebtoken": "^9.0.2",
     "mongoose": "^8.0.3"
   },
   "devDependencies": {
+    "@types/bcrypt": "^5.0.2",
+    "@types/jsonwebtoken": "^9.0.5",
     "typescript": "^5.3.3"
   }
 }`,
  },
];

export const dummyComments: PRComment[] = [
  {
    id: 1,
    body: 'Great implementation! The JWT approach looks solid. One thing to consider: should we add rate limiting to the login endpoint to prevent brute force attacks?',
    user: {
      login: 'bob-reviewer',
      avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
      html_url: 'https://github.com/bob-reviewer',
    },
    created_at: '2024-01-15T11:00:00Z',
    updated_at: '2024-01-15T11:00:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#issuecomment-1',
  },
  {
    id: 2,
    body: 'Good point! I\'ll add rate limiting in a follow-up PR. For now, the token expiry and refresh mechanism should help mitigate the risk.',
    user: {
      login: 'alice-dev',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      html_url: 'https://github.com/alice-dev',
    },
    created_at: '2024-01-15T11:30:00Z',
    updated_at: '2024-01-15T11:30:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#issuecomment-2',
  },
  {
    id: 3,
    body: 'The test coverage looks comprehensive. Could you also add a test for the token refresh flow?',
    user: {
      login: 'carol-lead',
      avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4',
      html_url: 'https://github.com/carol-lead',
    },
    created_at: '2024-01-15T14:00:00Z',
    updated_at: '2024-01-15T14:00:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#issuecomment-3',
  },
];

export const dummyReviewComments: PRReviewComment[] = [
  {
    id: 101,
    body: 'Consider using a constant-time comparison here to prevent timing attacks.',
    user: {
      login: 'bob-reviewer',
      avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
      html_url: 'https://github.com/bob-reviewer',
    },
    created_at: '2024-01-15T11:15:00Z',
    updated_at: '2024-01-15T11:15:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#discussion_r1',
    path: 'src/auth/login.ts',
    position: 28,
    original_position: 28,
    diff_hunk: '@@ -0,0 +1,68 @@\n+  const isValid = await comparePassword(password, user.passwordHash);',
    commit_id: 'abc123def456',
    pull_request_review_id: 201,
  },
  {
    id: 102,
    body: 'The error message "Invalid credentials" is good - it doesn\'t reveal whether the email exists.',
    user: {
      login: 'carol-lead',
      avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4',
      html_url: 'https://github.com/carol-lead',
    },
    created_at: '2024-01-15T14:05:00Z',
    updated_at: '2024-01-15T14:05:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#discussion_r2',
    path: 'src/auth/login.ts',
    position: 30,
    original_position: 30,
    diff_hunk: '@@ -0,0 +1,68 @@\n+    throw new Error(\'Invalid credentials\');',
    commit_id: 'abc123def456',
    pull_request_review_id: 202,
  },
];

export const dummyReviews: PRReview[] = [
  {
    id: 201,
    user: {
      login: 'bob-reviewer',
      avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
      html_url: 'https://github.com/bob-reviewer',
    },
    body: 'Overall looks good! Left a few comments. The security considerations are well thought out.',
    state: 'CHANGES_REQUESTED',
    submitted_at: '2024-01-15T11:20:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#pullrequestreview-201',
  },
  {
    id: 202,
    user: {
      login: 'carol-lead',
      avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4',
      html_url: 'https://github.com/carol-lead',
    },
    body: 'LGTM! Nice clean implementation. Approve once the minor comments are addressed.',
    state: 'APPROVED',
    submitted_at: '2024-01-15T14:10:00Z',
    html_url: 'https://github.com/example-org/my-app/pull/42#pullrequestreview-202',
  },
];

export const dummyPRContext: PRContext = {
  pr: dummyPR,
  files: dummyFiles,
  comments: dummyComments,
  reviewComments: dummyReviewComments,
  reviews: dummyReviews,
};
