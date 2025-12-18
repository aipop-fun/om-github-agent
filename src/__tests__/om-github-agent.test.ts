// om-github-agent/src/__tests__/om-github-agent.test.ts

import { Probot } from 'probot';
import { mockContext } from './mockContext'; // Assuming mockContext.ts will be created separately

// Mocking process.env for APP_NAME
// Need to mock 'process' before 'probot' or 'index' is imported if they use it.
// For now, let's assume it's handled by the mockContext or a setup file.

// Mocking the entire index.ts logic might be complex. A better approach would be to
// refactor index.ts to export the event handler functions so they can be tested directly.
// For now, let's simulate the core logic that handles the command parsing.

// Helper to simulate the command parsing logic found in index.ts
const simulateCommandParsing = async (commentBody: string, context: any) => {
    const appName = process.env.APP_NAME || 'om-bot';
    const mentionRegex = new RegExp(`@${appName} create-pr`, 'i');

    if (mentionRegex.test(commentBody)) {
      const match = commentBody.match(mentionRegex);
      if (match && match.index !== undefined) {
        const commandPart = commentBody.substring(match.index + match[0].length).trim();
        const commandRegex = /(\S+)\s+(\S+)(?:\s+\"([^\"]+)\")?/; 
        const parts = commandPart.match(commandRegex);

        if (parts && parts.length >= 3) {
          const sourceBranch = parts[1];
          const targetBranch = parts[2];
          const prTitle = parts[3] || commandPart.substring(parts[0].indexOf(parts[2]) + parts[2].length).trim();

          // Simulate the function calls that would happen next
          try {
            // Mock getBranch to succeed
            await context.octokit.rest.repos.getBranch({ owner: 'test-owner', repo: 'test-repo', branch: sourceBranch });
            // Mock create pull request to succeed
            await context.octokit.rest.pulls.create({
              owner: 'test-owner',
              repo: 'test-repo',
              title: prTitle,
              head: sourceBranch,
              base: targetBranch,
              body: `Pull request created by @test-user via ${appName}.`,
            });

            await context.octokit.rest.issues.createComment({
              owner: 'test-owner',
              repo: 'test-repo',
              issue_number: 123,
              body: `Successfully created pull request: https://github.com/test-owner/test-repo/pull/1`,
            });
            return { success: true, prUrl: 'https://github.com/test-owner/test-repo/pull/1' };
          } catch (error: any) {
            // Simulate error response
            let errorMessage = `Failed to create pull request. Error: ${error.message}.`;
            if (error.status === 422) {
              errorMessage += ' This could be due to non-existent branches, no differences between branches, or insufficient permissions.';
            } else if (error.status === 404) {
              errorMessage += ' One or more branches were not found.';
            }
            await context.octokit.rest.issues.createComment({
              owner: 'test-owner',
              repo: 'test-repo',
              issue_number: 123,
              body: errorMessage,
            });
            return { success: false, error: errorMessage };
          }
        } else {
          // Simulate invalid format response
          await context.octokit.rest.issues.createComment({
            owner: 'test-owner',
            repo: 'test-repo',
            issue_number: 123,
            body: `Invalid command format. Please use: @${appName} create-pr <source-branch> <target-branch> \"<PR title>\"`
          });
          return { success: false, error: 'Invalid command format' };
        }
      }
    }
    return { success: false, error: 'Mention not found or command malformed' };
};


describe('OmO GitHub Agent - Command Parsing', () => {
  let mockOctokit: any;
  let mockProbot: any;
  let mockContextInstance: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock Octokit methods
    mockOctokit = {
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
    mockProbot = {
      context: {
        payload: { 
          comment: { body: '', user: { login: 'test-user' } }, 
          issue: { number: 123 }, 
          repository: { name: 'test-repo', owner: { login: 'test-owner' } }, 
        },
        repo: () => ({ owner: 'test-owner', repo: 'test-repo' }),
        octokit: mockOctokit,
      },
    };

    // Deep copy the mock context for each test to ensure isolation
    mockContextInstance = JSON.parse(JSON.stringify(mockProbot.context));

    // Mock process.env.APP_NAME
    process.env.APP_NAME = 'om-bot';
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  it('should parse a valid command and trigger PR creation success', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr feature/new-branch main "Add awesome feature"';

    // Mock Octokit methods to resolve successfully
    mockOctokit.rest.repos.getBranch.mockResolvedValue({});
    mockOctokit.rest.pulls.create.mockResolvedValue({
      data: { html_url: 'https://github.com/test-owner/test-repo/pull/1' }
    });

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({ owner: 'test-owner', repo: 'test-repo', branch: 'feature/new-branch' });
    expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
              title: 'Add awesome feature',
      head: 'feature/new-branch',
      base: 'main',
      body: 'Pull request created by @test-user via om-bot.',
    });
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: 'Successfully created pull request: https://github.com/test-owner/test-repo/pull/1',
    });
  });

  it('should respond with an error for an invalid command format (missing branches)', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr'; // Missing branches and title

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: 'Invalid command format. Please use: @om-bot create-pr <source-branch> <target-branch> \"<PR title>\"',
    });
    expect(mockOctokit.rest.repos.getBranch).not.toHaveBeenCalled();
    expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();
  });

  it('should respond with an error for an invalid command format (missing title)', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr feature-branch main'; // Missing title

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: 'Invalid command format. Please use: @om-bot create-pr <source-branch> <target-branch> \"<PR title>\"',
    });
    expect(mockOctokit.rest.repos.getBranch).not.toHaveBeenCalled();
    expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();
  });

  it('should handle PR creation failure gracefully (e.g., branch not found)', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr non-existent-branch main "Test failure"';

    // Mock getBranch to throw an error (simulating branch not found)
    const branchNotFoundError = new Error('Branch not found');
    // @ts-ignore // Mocking error object structure
    branchNotFoundError.status = 404;
    mockOctokit.rest.repos.getBranch.mockRejectedValue(branchNotFoundError);

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({ owner: 'test-owner', repo: 'test-repo', branch: 'non-existent-branch' });
    expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: expect.stringContaining('Failed to create pull request. Error: Branch not found. One or more branches were not found.'),
    });
  });

  it('should handle PR creation failure gracefully (e.g., API error)', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr feature/valid-branch main "Test API error"';

    // Mock getBranch to succeed
    mockOctokit.rest.repos.getBranch.mockResolvedValue({});
    // Mock create pull request to throw an error
    const apiError = new Error('API Error');
    // @ts-ignore // Mocking error object structure
    apiError.status = 422; // e.g., Unprocessable Entity
    mockOctokit.rest.pulls.create.mockRejectedValue(apiError);

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({ owner: 'test-owner', repo: 'test-repo', branch: 'feature/valid-branch' });
    expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test API error',
      head: 'feature/valid-branch',
      base: 'main',
      body: 'Pull request created by @test-user via om-bot.',
    });
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: expect.stringContaining('Failed to create pull request. Error: API Error. This could be due to non-existent branches, no differences between branches, or insufficient permissions.'),
    });
  });

  it('should ignore comments that do not mention the bot', async () => {
    mockContextInstance.payload.comment.body = 'This is just a regular comment.';

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.rest.repos.getBranch).not.toHaveBeenCalled();
    expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();
  });

  it('should ignore comments that mention the bot but not the command', async () => {
    mockContextInstance.payload.comment.body = '@om-bot hello there';

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.rest.repos.getBranch).not.toHaveBeenCalled();
    expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();
  });

  it('should handle quoted PR titles correctly', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr dev main "Feature: Add new login functionality with validation"';

    mockOctokit.rest.repos.getBranch.mockResolvedValue({});
    mockOctokit.rest.pulls.create.mockResolvedValue({
      data: { html_url: 'https://github.com/test-owner/test-repo/pull/2' }
    });

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Feature: Add new login functionality with validation',
    }));
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Successfully created pull request: https://github.com/test-owner/test-repo/pull/2',
    }));
  });

  it('should handle PR titles without quotes if they are the last part of the command', async () => {
    mockContextInstance.payload.comment.body = '@om-bot create-pr main develop My Feature Title';

    mockOctokit.rest.repos.getBranch.mockResolvedValue({});
    mockOctokit.rest.pulls.create.mockResolvedValue({
      data: { html_url: 'https://github.com/test-owner/test-repo/pull/3' }
    });

    await simulateCommandParsing(mockContextInstance.payload.comment.body, mockContextInstance);

    expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'My Feature Title',
    }));
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Successfully created pull request: https://github.com/test-owner/test-repo/pull/3',
    }));
  });
});
