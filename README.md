# Synagogue Management App

Next.js 15 project scaffold for a synagogue management system, fully RTL and Hebrew-first.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS
- shadcn-style UI components
- Supabase (schema in `supabase/schema.sql`)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and set your Supabase values.

3. Run development server:

   ```bash
   npm run dev
   ```

4. Apply DB schema in Supabase SQL editor using `supabase/schema.sql`.

## Implemented

- RTL Hebrew global layout (`dir="rtl"`, Hebrew font)
- Public homepage with:
  - Header
  - Prayer schedule
  - Daily halacha
  - Footer
- Initial `/admin` route placeholder
- Supabase schema for members, schedules, halacha, lessons, donations, and seats
