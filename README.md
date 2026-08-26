# HackTrack MMU Frontend

## Getting Started

Follow the instructions below to set up and run the project locally.

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (version 20.9.0 or above is required).

### Installation

1. Navigate to the project root directory.
2. Install the package dependencies:
   ```bash
   npm install
   ```

### Configuration (Environment Variables)

Create a `.env` file in the project root directory and add the following variables:

| Variable                      | Description                                         | Example / Default Value |
| ----------------------------- | --------------------------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`         | The base URL of the backend API server.             | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_MEMBER_PASSWORD` | Password required for general member portal access. | `password goes here`    |
| `NEXT_PUBLIC_ADMIN_PASSWORD`  | Password required for admin panel access.           | `password goes here`    |

Example `.env` configuration:

```env
NEXT_PUBLIC_MEMBER_PASSWORD="password goes here"
NEXT_PUBLIC_ADMIN_PASSWORD="password goes here"
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000
```

---

## Available Scripts

In the project directory, you can run the following scripts:

### Development Server

Runs the app in development mode on port `8000` with Turbopack:

```bash
npm run dev
```

Open [http://localhost:8000](http://localhost:8000) with your browser to view it.

### Build for Production

Builds the application for production usage into the `.next` folder:

```bash
npm run build
```

### Start Production Server

Starts the Next.js production server on port `8080` (requires building the app first):

```bash
npm run start
```

### Code Quality Utilities

- **Format Code**: Formats files using Prettier.
  ```bash
  npm run prettier
  ```
- **Lint Code**: Analyzes code quality using Next.js ESLint configuration.
  ```bash
  npm run lint
  ```
