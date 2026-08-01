# Airway Motel — Admin Management System

A full-scale admin management system for Airway Motel that digitizes the entire manual check-in/checkout workflow.

## Tech Stack

- **Frontend:** React 19 + Vite
- **Backend:** Supabase (Database, Auth, Storage, Realtime)
- **State:** Zustand
- **Forms:** React Hook Form + Zod validation
- **Styling:** Vanilla CSS with design tokens
- **Icons:** Lucide React
- **PDF:** jsPDF + html2canvas
- **Signatures:** react-signature-canvas
- **QR Codes:** qrcode.react
- **Dates:** date-fns

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app runs with mock data when Supabase credentials are not configured.

## Project Structure

```
src/
├── config/          # Supabase client & app configuration
├── hooks/           # Custom React hooks
├── context/         # React context providers
├── stores/          # Zustand state management
├── lib/             # Utility functions & helpers
├── services/        # API/data access layer (Supabase or mock)
├── data/            # Mock data & constants (terms, prices)
├── components/      # Reusable UI components
│   ├── ui/          # Primitives (Button, Input, Modal, Card)
│   ├── layout/      # Sidebar, Header, PageWrapper
│   ├── rooms/       # Room-specific components
│   ├── guests/      # Guest-specific components
│   ├── checkin/     # Check-in flow components
│   ├── checkout/    # Checkout flow components
│   └── scan/        # QR code & mobile handoff
├── pages/           # Full page components (one per route)
└── assets/          # Static assets
```

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Login | Admin authentication |
| `/dashboard` | Dashboard | Overview with key metrics |
| `/check-in` | New Check-In | Step-by-step guest registration |
| `/rooms` | Room Status | Visual room grid with status colors |
| `/checkout` | Checkout | Late fee calc, receipt generation |
| `/guests` | Guest History | Search past guests |
| `/settings` | Settings | Room prices, policies, configuration |
| `/scan/:sessionId` | Mobile Scan | QR-triggered page for ID photo & signature |
