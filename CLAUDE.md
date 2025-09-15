# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Modeler" - a Next.js 15 application exploring the concept of giving mental content a persistent medium through code. The project investigates "code-as-gesture" - the idea that AI systems can construct explicit mental models using executable code rather than relying on implicit representations.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 with PostCSS
- **Fonts**: Geist Sans and Geist Mono from Google Fonts
- **Build Tool**: Turbopack (Next.js' new bundler)

## Development Commands

```bash
# Start development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

## Project Structure

```
src/
├── app/              # App Router pages and layouts
│   ├── globals.css   # Global styles with Tailwind CSS v4
│   ├── layout.tsx    # Root layout with fonts and metadata
│   └── page.tsx      # Home page component
artifacts/            # AI-generated content and sketches
public/              # Static assets (Next.js SVGs, etc.)
```

## Key Configuration

- **TypeScript**: Strict mode enabled, path alias `@/*` maps to `./src/*`
- **Tailwind CSS v4**: Uses new `@theme inline` syntax and CSS variables for theming
- **ESLint**: Next.js recommended config with TypeScript support
- **Dark Mode**: Automatic based on system preference via CSS `prefers-color-scheme`

## Development Notes

- Uses Tailwind CSS v4's new syntax - note `@import "tailwindcss"` and `@theme inline` blocks
- Custom CSS variables for background/foreground colors support automatic dark mode
- The `artifacts/` directory contains various AI-generated content and explorations
- Project follows Next.js 15 App Router conventions with TypeScript

## Architecture Context

This is an early-stage project exploring AI mental model representation. The codebase is currently minimal (standard Next.js starter) but the conceptual framework described in README.md suggests future development toward:

- Code-based mental model representation systems
- AI systems that can construct and execute their own logical models
- Interactive tools for "code-as-gesture" exploration