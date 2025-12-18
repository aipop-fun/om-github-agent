// om-github-agent/src/__tests__/mockContext.ts

// Mocking process.env for APP_NAME
const mockProcessEnv = {
  APP_NAME: process.env.APP_NAME || 'om-bot',
};

// Mock Octokit methods
export const mockOctokit = {
  rest: {
    issues: {
      createComment: jest.fn(),
    },
    pulls: {
      create: jest.fn(),
    },
    repos: {
      getBranch: jest.fn(),
    },
  },
};

// Mock Probot context structure
export const mockContext = {
  payload: {
    comment: { body: '', user: { login: 'test-user' } },
    issue: { number: 123 },
    repository: { name: 'test-repo', owner: { login: 'test-owner' } },
  },
  repo: () => ({ owner: 'test-owner', repo: 'test-repo' }),
  octokit: mockOctokit,
};

// Mocking process module to provide access to mockProcessEnv
jest.mock('process', () => ({
  ...jest.requireActual('process'),
  env: mockProcessEnv,
}));
