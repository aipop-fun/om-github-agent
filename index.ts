import express, { Application } from 'express';
import dotenv from 'dotenv';
import { Probot } from 'probot';
import { createNodeMiddleware } from '@octokit/webhooks';
import fs from 'fs'; 
import pino from 'pino';

// Setup logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-dd-mm, h:MM:ss',
      ignore: 'pid,hostname',
    }
  }
});

dotenv.config();

// Ensure environment variables are loaded and set
const appId = process.env.APP_ID;
const privateKeyPath = process.env.PRIVATE_KEY_PATH; 
const webhookSecret = process.env.WEBHOOK_SECRET;
const appName = process.env.APP_NAME || 'om-bot'; 

if (!appId || !privateKeyPath || !webhookSecret) {
  logger.error('Missing required environment variables: APP_ID, PRIVATE_KEY_PATH, WEBHOOK_SECRET');
  process.exit(1);
}

// Read the private key from the file
let privateKey: string;
try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
} catch (error: any) {
  logger.error(`Error reading private key file at ${privateKeyPath}: ${error.message}`);
  process.exit(1);
}

const app: Application = express();
app.use(express.json());

// Initialize Probot
const probot = new Probot({
  appId: Number(appId), 
  privateKey: privateKey,
});

// Register the webhook middleware from @octokit/webhooks
const webhookMiddleware = createNodeMiddleware(probot.receive, {
  secret: webhookSecret,
});

app.use('/webhook', webhookMiddleware);

// Basic root route
app.get('/', (req, res) => {
  logger.info('GET / request received');
  res.send('Oh My Opencode GitHub Agent is running!');
});

// --- Event Handlers ---

// Handle 'issue_comment' events
probot.on('issue_comment.created', async (context) => {
  const { comment } = context.payload;
  const { owner, repo } = context.repo();
  const commentBody = comment.body;
  const commentAuthor = comment.user.login;

  logger.info(`Received issue_comment from ${commentAuthor} in ${owner}/${repo}: ${commentBody}`);

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

        if (!sourceBranch || !targetBranch || !prTitle) {
          await context.octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: context.payload.issue.number,
            body: `Invalid command format. Please use: @${appName} create-pr <source-branch> <target-branch> \"<PR title>\"`
          });
          return;
        }

        logger.info(`Attempting to create PR: source=${sourceBranch}, target=${targetBranch}, title=${prTitle}`);

        try {
          await context.octokit.rest.repos.getBranch({ owner, repo, branch: sourceBranch });

          const prResponse = await context.octokit.rest.pulls.create({
            owner,
            repo,
            title: prTitle,
            head: sourceBranch,
            base: targetBranch,
            body: `Pull request created by @${commentAuthor} via ${appName}.`,
          });

          await context.octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: context.payload.issue.number,
            body: `Successfully created pull request: ${prResponse.data.html_url}`,
          });
        } catch (error: any) {
          logger.error({ error: error, message: 'Error creating pull request' });
          let errorMessage = `Failed to create pull request. Error: ${error.message}.`;
          if (error.status === 422) { 
            errorMessage += ' This could be due to non-existent branches, no differences between branches, or insufficient permissions.';
          } else if (error.status === 404) { 
            errorMessage += ' One or more branches were not found.';
          }
          await context.octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: context.payload.issue.number,
            body: errorMessage,
          });
        }
      } else {
        await context.octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: context.payload.issue.number,
          body: `Invalid command format. Please use: @${appName} create-pr <source-branch> <target-branch> \"<PR title>\"`
        });
      }
    }
  }
});

// Handle installation event
probot.on('installation.created', async (context) => {
  logger.info('GitHub App installed or updated.');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ err: reason, promise: promise }, 'Unhandled Rejection at:');
  // Consider more graceful shutdown or error reporting here if necessary
});

// Listen on a specific port
const port = parseInt(process.env.PORT || '3000', 10); 

// Start the server
app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
  logger.info(`Webhook endpoint: /webhook`);
  logger.info(`Make sure your GitHub App webhook is configured to point to this URL and port.`);
});

// Optional: Log any unhandled events for debugging
// probot.onAny(async (context) => {
//   logger.debug(`Unhandled event: ${context.name}`);
// });