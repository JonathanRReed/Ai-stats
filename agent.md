---
name: "AI-Understand Astro Project"
description: "An Astro-based web application for understanding and working with AI models through natural language interfaces, built with Supabase backend."
category: "Astro Web Development"
author: "Jonathan Reed"
authorUrl: "https://github.com/jonathanwreed"
tags: ["astro", "supabase", "ai", "typescript", "cloudflare", "openai-codex"]
lastUpdated: "2025-08-02"
---

# AI-Understand Astro Project - Codex Agent Guide

## 🎯 Project Purpose

This is an **Astro-based** web application that helps users understand and interact with AI models. The project uses **Supabase** for backend services and **Cloudflare** for deployment. It has a design doc to help explain how things may work @design doc.md

## 🏗️ Current Tech Stack

- **Framework**: Astro 5.12.7 (Static Site Generator)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Cloudflare Pages
- **Language**: TypeScript
- **Package Manager**: npm
- **Primary Dependencies**: @supabase/supabase-js

## 📁 Project Structure Analysis

```
ai-understand/
├── .astro/                     # Astro build cache
├── src/                       # Source code
│   ├── components/           # Astro components
│   ├── layouts/              # Astro layouts
│   ├── pages/               # Astro pages (file-based routing)
│   └── styles/              # Global styles
├── public/                  # Static assets
├── dist/                    # Build output
├── astro.config.mjs         # Astro configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies
└── .env                   # Environment variables
```

## 🚀 Development Workflow for Codex

### Initial Setup Commands
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Setup
Create `.env` file with:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🎨 AI Integration Guidelines

### Supabase Integration Pattern
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Astro Component Structure
```astro
---
// src/pages/index.astro
import Layout from '../layouts/Layout.astro'
import { supabase } from '../lib/supabase'

const { data: aiModels } = await supabase.from('ai_models').select('*')
---

<Layout title="AI Understand">
  <main>
    <h1>AI Models</h1>
    {aiModels.map(model => (
      <div>{model.name}</div>
    ))}
  </main>
</Layout>
```

## 🧪 Testing Strategy

### Unit Testing
- **Framework**: Use Astro's built-in testing utilities
- **Location**: `src/tests/` directory
- **Naming**: `*.test.ts` for utilities, `*.spec.ts` for components

### Integration Testing
- **Supabase**: Test database queries and auth flows
- **API**: Test API routes with mock data

## 📊 Data Models

### Supabase Tables Structure
```sql
-- ai_models table
CREATE TABLE ai_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- conversations table
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  model_id UUID REFERENCES ai_models(id),
  prompt TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔄 Git Workflow

### Branch Naming
- `feature/add-ai-model-selection`
- `fix/supabase-connection-issue`
- `chore/update-dependencies`

### Commit Messages
Follow conventional commits:
- `feat: add AI model selection component`
- `fix: resolve Supabase connection timeout`
- `docs: update README with setup instructions`

## 🌐 Deployment

### Cloudflare Pages Setup
1. Connect GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set build output directory: `dist`
4. Configure environment variables in Cloudflare dashboard

### Environment Variables for Production
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-key
```

## 🔍 Common Tasks for Codex

### Adding a New Page
1. Create `src/pages/new-page.astro`
2. Add navigation link in layout
3. Update sitemap if needed

### Adding Supabase Integration
1. Create `src/lib/supabase.ts`
2. Add environment variables
3. Create queries in components
4. Add error handling

### Styling with Tailwind
1. Install Tailwind CSS: `npm install -D tailwindcss postcss autoprefixer`
2. Create `tailwind.config.js`
3. Add Tailwind directives to `src/styles/global.css`

## 🚨 Error Handling

### Supabase Errors
```typescript
try {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw error
  return data
} catch (error) {
  console.error('Supabase error:', error)
  return null
}
```

### Astro Component Errors
```astro
---
const { data, error } = await someAsyncOperation()
if (error) {
  return Astro.redirect('/error')
}
---
```

## 📚 Key Commands for Codex

```bash
# Install new dependency
npm install [package-name]

# Add development dependency
npm install -D [package-name]

# Run type checking
npm run build

# Check for Astro issues
npm run astro check

# Update dependencies
npm update
```

## 🔗 Reference Resources

- [Astro Documentation](https://docs.astro.build)
- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## 📝 Changelog

### v0.1.0 (2025-08-02)
- Initial Astro setup
- Supabase integration
- Basic project structure
- Codex agent documentation

---

**Note for Codex**: This is an Astro project, not Next.js. Focus on Astro-specific patterns, file-based routing, and server-side rendering capabilities. Use Supabase client-side for real-time features and auth.

## Project Structure

```
ai-understand/
├── src/
│   ├── app/                    # Next.js 13+ app directory
│   │   ├── api/                # API routes
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility functions and libraries
│   │   │   ├── ai/             # AI integration logic
│   │   │   └── utils/          # Helper functions
│   │   ├── styles/             # Global styles
│   │   └── types/              # TypeScript type definitions
│   ├── public/                 # Static assets
│   └── tests/                  # Test files
├── .github/                    # GitHub configurations
│   └── workflows/              # GitHub Actions workflows
├── .husky/                     # Git hooks
├── .vscode/                    # VS Code settings
├── public/                     # Public assets
├── .env.local                  # Local environment variables
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore file
├── next.config.js              # Next.js configuration
├── package.json                # Project dependencies
├── README.md                   # Project documentation
└── tsconfig.json               # TypeScript configuration
```

## Development Guidelines

### Code Style

- Use TypeScript for type safety
- Follow the Airbnb JavaScript/TypeScript Style Guide
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages following Conventional Commits
- Keep components small and focused on a single responsibility

### Naming Conventions

- **Components**: PascalCase (e.g., `AiResponse.tsx`)
- **Files & Folders**: kebab-case (e.g., `api-routes/`)
- **Variables & Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase with `I` prefix for interfaces (e.g., `IUser`)
- **Test files**: `*.test.ts` or `*.test.tsx`

### Git Workflow

1. Create a new branch for each feature/fix: `feature/feature-name` or `fix/issue-description`
2. Make small, focused commits with clear messages
3. Open a Pull Request for code review
4. Ensure all tests pass before merging
5. Use `Squash and Merge` for PRs to maintain a clean commit history

## Environment Setup

### Prerequisites

- Node.js 18+
- npm 9+ or yarn 1.22+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-understand.git
cd ai-understand

# Install dependencies
npm install
# or
yarn install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys and configurations

# Start the development server
npm run dev
# or
yarn dev
```

## AI Integration

### OpenAI API

The application uses the OpenAI API for AI model interactions. To set up:

1. Get an API key from [OpenAI](https://platform.openai.com/account/api-keys)
2. Add it to your `.env.local` file:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

### Making AI Requests

Use the `useAI` hook to interact with AI models:

```typescript
import { useAI } from '@/lib/ai/useAI';

const { response, loading, error, sendPrompt } = useAI();

// Example usage
const handleSubmit = async (prompt: string) => {
  try {
    await sendPrompt({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
  } catch (err) {
    console.error('Error sending prompt:', err);
  }
};
```

## Testing

### Running Tests

```bash
# Run unit tests
npm test
# or
yarn test

# Run integration tests
npm run test:integration
# or
yarn test:integration

# Run end-to-end tests
npm run test:e2e
# or
yarn test:e2e
```

### Testing Guidelines

- Write unit tests for utility functions and custom hooks
- Use React Testing Library for component tests
- Write integration tests for critical user flows
- Use Cypress for end-to-end testing
- Aim for at least 80% test coverage

## Deployment

### Production Build

```bash
# Create a production build
npm run build
# or
yarn build

# Start the production server
npm start
# or
yarn start
```

### Environment Variables

Ensure these environment variables are set in your production environment:

```
NEXT_PUBLIC_API_URL=your_api_url
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
```

## Performance Optimization

### Frontend

- Implement code splitting with dynamic imports
- Use `next/image` for optimized images
- Implement proper caching headers
- Use React.memo and useMemo for performance optimization
- Lazy load non-critical components

### Backend

- Implement API response caching
- Use server-side rendering (SSR) or static site generation (SSG) where appropriate
- Optimize database queries
- Implement rate limiting for API routes

## Security Considerations

### Data Security

- Never expose API keys in client-side code
- Sanitize all user inputs
- Implement proper CORS policies
- Use HTTPS in production

### Authentication & Authorization

- Implement proper session management
- Use secure, HTTP-only cookies for authentication
- Implement role-based access control (RBAC)
- Regularly rotate API keys

## Monitoring and Logging

### Application Monitoring

- Set up error tracking with Sentry
- Monitor performance metrics
- Set up alerts for critical errors

### Logging

- Use structured logging
- Include request IDs for tracing
- Log errors with appropriate context
- Rotate logs to prevent disk space issues

## Common Issues

### API Rate Limiting

**Issue**: Hitting rate limits with the OpenAI API.
**Solution**: 
- Implement exponential backoff for retries
- Cache responses when possible
- Consider using a queue system for high-volume requests

### Large Bundle Size

**Issue**: JavaScript bundle size is too large.
**Solution**:
- Use code splitting
- Analyze bundle with `@next/bundle-analyzer`
- Remove unused dependencies
- Use dynamic imports for large libraries

## Reference Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Changelog

### v0.1.0 (2025-08-02)

- Initial project setup
- Basic AI integration with OpenAI
- Core UI components
- Basic testing infrastructure
