import express, { Application } from 'express';
import dotenv from 'dotenv';
import { Probot, Application as ProbotApplication } from 'probot';
import { createNodeMiddleware } from '@octokit/webhooks';
import fs from 'fs'; // Needed for reading private key if not a string

dotenv.config();

// Ensure environment variables are loaded and set
const appId = process.env.APP_ID;
const privateKeyPath = process.env.PRIVATE_KEY_PATH; // Suggest using a path for the private key
const webhookSecret = process.env.WEBHOOK_SECRET;
const appName = process.env.APP_NAME || 'om-bot'; // Use app name for mention

if (!appId || !privateKeyPath || !webhookSecret) {
  console.error('Missing required environment variables: APP_ID, PRIVATE_KEY_PATH, WEBHOOK_SECRET');
  process.exit(1);
}

// Read the private key from the file
let privateKey: string;
try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
} catch (error) {
  console.error(`Error reading private key file at ${privateKeyPath}:`, error);
  process.exit(1);
}

const app: Application = express();
app.use(express.json());

// Initialize Probot
// Probot uses its own Octokit instance, no need to pass it.
// The webhook secret is primarily used by the middleware for signature verification.
const probot = new Probot({
  appId: Number(appId), // APP_ID should be a number
  privateKey: privateKey,
});

// Register the webhook middleware from @octokit/webhooks
// This middleware verifies the webhook signature and passes the event to Probot.
const webhookMiddleware = createNodeMiddleware(probot.receive, {
  secret: webhookSecret,
});

app.use('/webhook', webhookMiddleware);

// Basic root route
app.get('/', (req, res) => {
  res.send('Oh My Opencode GitHub Agent is running!');
});

// --- Event Handlers ---

// Handle 'issue_comment' events
probot.on('issue_comment.created', async (context) => {
  const { comment } = context.payload;
  const { owner, repo } = context.repo();
  const commentBody = comment.body;
  const commentAuthor = comment.user.login;

  console.log(`Received issue_comment from ${commentAuthor} in ${owner}/${repo}:`, commentBody);

  // Check for the mention and command syntax: "@om-bot create-pr <source-branch> <target-branch> \"<PR title>\""
  const mentionRegex = new RegExp(`@${appName} create-pr`, 'i');

  if (mentionRegex.test(commentBody)) {
    const match = commentBody.match(mentionRegex);
    if (match && match.index !== undefined) {
      const commandPart = commentBody.substring(match.index + match[0].length).trim();
      // Regex to capture branches and a title, allowing for quotes around the title.
      // It tries to capture:
      // Group 1: source branch
      // Group 2: target branch
      // Group 3: The entire quoted title (if present) OR the rest of the string if no quotes.
      const commandRegex = /(\S+)\s+(\S+)(?:\s+\"([^\"]+)\")?/; // Non-greedy match for branches, then optionally a quoted title
      const parts = commandPart.match(commandRegex);

      if (parts && parts.length >= 3) {
        const sourceBranch = parts[1];
        const targetBranch = parts[2];
        // If a quoted title was found (parts[3]), use it. Otherwise, use the rest of the command part as title.
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

        console.log(`Attempting to create PR: source=${sourceBranch}, target=${targetBranch}, title=${prTitle}`);

        try {
          // Check if source branch exists (optional but good practice)
          await context.octokit.rest.repos.getBranch({ owner, repo, branch: sourceBranch });

          // Create the pull request
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
          console.error('Error creating pull request:', error);
          let errorMessage = `Failed to create pull request. Error: ${error.message}.`;
          if (error.status === 422) { // Unprocessable Entity - often means branches don't exist or no diff
            errorMessage += ' This could be due to non-existent branches, no differences between branches, or insufficient permissions.';
          } else if (error.status === 404) { // Not Found
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

// Handle installation event to allow users to install the app
probot.on('installation.created', async (context) => {
  console.log('GitHub App installed or updated.');
  // You might want to send a message to the repo's main branch README or a default issue.
  // For now, just logging is sufficient for the mechanism.
});

// Listen on a specific port
const port = parseInt(process.env.PORT || '3000', 10); // Ensure port is a number

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Webhook endpoint: /webhook`);
  console.log(`Make sure your GitHub App webhook is configured to point to this URL and port.`);
});

// Optional: Log any unhandled events for debugging
// probot.onAny(async (context) => {
//   console.log(`Unhandled event: ${context.name}`);
// });
