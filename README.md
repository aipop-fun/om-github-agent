# OmO GitHub Agent

This agent automates the creation of GitHub Pull Requests directly from comments on issues or pull requests.

## Features

*   **Automated PR Creation:** Trigger PRs by mentioning the bot (`@om-bot`) in a comment with a specific command format.
*   **Branch Management:** Specify source and target branches for the PR.
*   **Customizable Titles:** Provide a title for the pull request.
*   **Clear Feedback:** Receive automated comments on the issue indicating the success or failure of the PR creation.

## Getting Started

### Prerequisites

*   **Node.js:** Version 20 or higher (or Bun installed).
*   **GitHub Account:** With necessary permissions to create repositories and manage apps.
*   **GitHub App:** You need to create a GitHub App with the following configurations:
    *   **Permissions:**
        *   Contents: Read & write
        *   Issues: Read & write
        *   Pull requests: Read & write
    *   **Webhook URL:** Set this to your deployed agent's webhook endpoint (e.g., `https://your-domain.com/webhook`).
    *   **Webhook Secret:** A secret string for webhook verification.
    *   **Subscribe to Events:** `issue_comment` and `installation`.
*   **Private Key:** Download the private key (`.pem` file) for your GitHub App.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/aipop-fun/om-github-agent.git
    cd om-github-agent
    ```

2.  **Install dependencies using Bun:**
    ```bash
    bun install
    ```

### Configuration

Create a `.env` file in the root of the project with the following variables:

```env
APP_ID=YOUR_GITHUB_APP_ID
PRIVATE_KEY_PATH=./path/to/your/private-key.pem
WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
PORT=3000
APP_NAME=om-bot
```

*   Replace `YOUR_GITHUB_APP_ID` with your GitHub App's ID.
*   Replace `./path/to/your/private-key.pem` with the actual path to your downloaded private key file.
*   Replace `YOUR_WEBHOOK_SECRET` with the secret you configured for your GitHub App.
*   `PORT` is the port the agent will listen on (default is 3000).
*   `APP_NAME` is the name used for mentioning the bot (default is `om-bot`).

### Running the Agent Locally

```bash
bun run start
```

The agent will start listening on the specified port. Ensure your GitHub App's webhook is configured to point to the `/webhook` endpoint of your running agent.

## Usage

To create a pull request, comment on a GitHub issue or pull request with the following format:

```
@om-bot create-pr <source-branch> <target-branch> "<PR title>"
```

**Example:**

```
@om-bot create-pr feature/my-new-feature main "Add new feature X"
```

This command will attempt to create a pull request from the `feature/my-new-feature` branch to the `main` branch with the title "Add new feature X".

## Development

### Running Tests

```bash
bun run test
```

### Building the Project

```bash
bun run build
```

## Contributing

Contributions are welcome! Please refer to the `CONTRIBUTING.md` file for guidelines.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
