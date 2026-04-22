# ZAPAI CRM Design System

## Overview

This design system defines a unified premium SaaS UI language for the ZAPAI CRM frontend.

Design direction:
- Clean and minimal structure
- Fast scanning and low visual noise
- Dark-mode first with subtle contrast layers
- Consistent typography and spacing

Inspiration references:
- Linear
- Vercel
- Stripe
- Notion
- Supabase

## Color System

Core tokens are defined in frontend/src/styles.css.

Base:
- --bg-base: app background
- --bg-surface: main panel surface
- --bg-surface-soft: secondary panel surface

Text:
- --text-primary: main content text
- --text-secondary: secondary supporting text
- --text-meta: small metadata labels

Accent:
- --accent: primary interactive accent
- --accent-soft: low-emphasis accent background

Usage rules:
- Use high-contrast text only for headings and key values
- Use meta text for timestamps, labels, and counters
- Keep borders low contrast (white/10 style) for premium minimalism

## Typography

Typography scale is standardized with utility classes:
- Title: 20px (.text-title)
- Section: 16px (.text-section)
- Body: 14px (.text-body)
- Meta: 12px (.text-meta)

Guidelines:
- One title per page section
- Section titles for cards and panels
- Body text for content and controls
- Meta text for helper labels and timestamps

## Spacing and Layout

Global layout rules:
- Card radius: large, soft corners (12-14px)
- Use 8px spacing rhythm through the interface
- Preserve visual breathing room in dense views

Standard page structure:
1. PageHeader
2. Actions bar
3. Filters row
4. Main content
5. Footer or pagination context

Implemented with:
- components/layout/PageHeader.tsx
- components/layout/PageScaffold.tsx

## Core UI Components

Implemented primitives:
- Button
- Card
- Badge
- Tag
- Tooltip
- Modal
- Input
- Avatar
- Dropdown
- Tabs
- SidebarItem
- PageHeader
- DataTable
- StatCard
- SkeletonLoader

Locations:
- frontend/src/components/ui
- frontend/src/components/layout

## Sidebar and Navigation

Primary navigation:
- Dashboard
- Inbox
- Contacts
- Campaigns
- Automation
- Analytics
- Settings

Notes:
- Subtle emoji accents are used only in labels where helpful
- Sidebar collapses on smaller screens

## Inbox UX Standards

Inbox structure:
- Left: conversation list
- Center: chat window
- Right: AI insights and quick replies

UX enhancements:
- Conversation list virtualized window rendering
- Typing indicator component
- Message reaction chips
- Improved timestamp visibility and spacing hierarchy

## Performance Guidelines

Current optimization patterns:
- Page-level lazy loading in App.tsx
- Conversation list lightweight virtualization
- Memoized computed values in heavy screens

Guidelines for future additions:
- Avoid inline large render trees in pages
- Extract domain hooks for state-heavy pages
- Prefer skeleton loaders over text-only loading states

## Migration Rules

When creating or refactoring pages:
1. Use PageHeader for title/subtitle/actions
2. Wrap page sections with PageScaffold
3. Use Dropdown instead of raw select
4. Use DataTable/StatCard for consistency in data views
5. Keep typography classes aligned to Title/Section/Body/Meta scale

## Related Files

- frontend/src/styles.css
- frontend/src/layout/AppLayout.tsx
- frontend/src/layout/Sidebar.tsx
- frontend/src/layout/Topbar.tsx
- frontend/src/components/layout/PageHeader.tsx
- frontend/src/components/layout/PageScaffold.tsx
- frontend/src/components/ui
