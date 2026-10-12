# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

### Development Commands

- **Dev server:** `npm run dev` (runs on port 3000, with Webpack)
- **Build:** `npm run build` (Next.js 16 Turbopack production build)
- **Start:** `npm start` (runs production-built app)
- **Lint:** `eslint` (ESLint 9 with Next.js config)

### Environment Setup

- **API Base:** Configured via `NEXT_PUBLIC_API_URL` in `.env` (default: `http://localhost:9000/api`)
- **Razorpay:** Payment gateway integration via `NEXT_PUBLIC_RAZORPAY_KEY_ID` (test mode)
- **Path alias:** `@/*` maps to `./src/*`

---

## Project Overview

**TNJA Frontend** is a role-based tournament management system for the Tamil Nadu Judo Association. It manages:

- **Tournaments:** District, State, and Zonal levels with draw generation, bracket management, and match scoreboarding
- **Players:** Registration, profile management, tournament participation tracking
- **Coaches:** Student management with performance dashboards
- **Admins:** Tournament oversight, results tracking, approvals

### Current Architecture Pattern

- **Next.js 16** (App Router, client/server components)
- **React 19** with Framer Motion for animations
- **Tailwind CSS 4** for styling
- **JWT authentication** via localStorage
- **Backend API:** Node.js (separate repo) at `http://localhost:9000/api`

---

## Key Architecture

### Role-Based Navigation

The dashboard layout (`src/app/(dashboard)/layout.tsx`) renders different navigation menus based on `userRole` stored in localStorage:

- **ADMIN** → Tournament management, approvals, member oversight
- **CLUB** → Event creation, tournament hosting
- **COACH** → Student management with performance metrics
- **PLAYER** → Tournament registration, personal tournaments view

### Tournament Management Flow

1. **Creation** (`/dashboard/club/tournaments`) → Set category (age, gender, weight), level (DISTRICT/STATE/ZONE)
2. **Registration** → Players register with physical details, Razorpay payment
3. **Draw Generation** (`/dashboard/admin/tournaments/[id]`) → IJF standard seeding (S1 top, S2 bottom, S3/S4 opposite quarters)
4. **Bracket Display** → Separated by draw categories (ageGroup + gender + weightCategory)
5. **Match Scoreboarding** → Real-time scoring with auto-advancement
6. **Results Tracking** → View completed matches, export PDFs

### Recent Major Features (Implemented This Session)

**Auto-Advancement System:**

- When match completes, winner automatically advances to next-round TBD slot
- Backend function `autoAdvanceWinner()` in tournament controller handles slot calculation
- Frontend real-time updates with Framer Motion animations (TBD → winner name with green highlight)

**Results & Reports Tab:**

- New "Results & Reports" tab shows all completed matches per round
- Displays winner (green), opponent (gray), and next match info (blue)
- PDF export generates professional match scorecards
- Integrated in `src/app/(dashboard)/dashboard/admin/tournaments/[id]/page.tsx`

**Scoreboard Enhancements:**

- Three action buttons after match completion:
  1. ✅ Save Match Result (green) → Explicit DB save with confirmation
  2. 📥 Download Report (PDF) (blue) → Print dialog for PDF/paper
  3. ↺ New Match / Reset (gray) → Clear scores for next match
- Uses `window.open()` for reliable PDF generation with fallback to blob URLs

---

## Critical Implementation Details

### Tournament Draw Data Structure

```typescript
DrawCategory {
  ageGroup: string;        // JUNIOR, CADET, SUB_JUNIOR, SENIOR
  gender: string;          // MALE, FEMALE
  weightCategory: string;  // e.g., "48 kg"
  rounds: BracketMatch[][];
  generated: boolean;
  saved: boolean;
}

BracketMatch {
  matchId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  slotA, slotB: {
    playerId: string | null;
    playerName: string;     // "TBD" until assigned
    club: string;
    isBye: boolean;
    seedNumber?: number;
  };
  winnerId: string | null;
  scoreA, scoreB: { ippon, wazaAri, yuko, shido };
  winMethod: string;
  logs: MatchLog[];
}
```

### Filtering & Display

- **Players view:** Tournaments filtered by `tournament.gender === player.gender || tournament.gender === "BOTH"`
- **Zonal tournaments:** Filtered by `tournament.zoneId === player.district.zoneName` (exact match)
- **Gender filter in bracket:** No "ALL" option; defaults to "MALE"; enforced at dropdown level to prevent mixed-gender matches

### API Integration Pattern

- All requests use `Authorization: Bearer {token}` header from localStorage
- Base URL: `process.env.NEXT_PUBLIC_API_URL` (fallback: `http://localhost:9000/api`)
- Responses typically: `{ status: string; data?: T; message?: string; error?: string }`
- Errors are logged but often don't show user-facing alerts (add toast for UX)

### Authentication

- **Token storage:** localStorage with key `"token"`
- **Role storage:** localStorage with keys `"userRole"`, `"userName"`
- **Logout:** Clears token and redirects to login
- **Protected routes:** Redirect on missing token happens in layout (client-side)

### State Management

- **Local state:** React `useState` (no Redux/Zustand)
- **Shared notifications:** `localStorage` + `window.dispatchEvent` for cross-tab comms
- **Toast messages:** Generic `showToast(msg, type)` in dashboard layout

---

## Common Patterns

### Fetching Data with Auth

```typescript
const token = localStorage.getItem("token");
const res = await fetch(`${API_BASE}/endpoint`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) throw new Error(await res.text());
const data = await res.json();
```

### Modal/Overlay Pattern

Uses Framer Motion `AnimatePresence` + `motion.div` for smooth enter/exit:

```typescript
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Form State Management

Forms use local `useState` for input fields, validation on submit:

```typescript
const [formData, setFormData] = useState({ field1: "", field2: "" });
const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
};
```

---

## File Structure Overview

```
src/
  app/
    (dashboard)/          // Authenticated dashboard routes
      layout.tsx          // Role-based navigation, auth check
      dashboard/
        admin/
          tournaments/    // Tournament CRUD, draw generation, admin controls
          approvals/      // Approval workflows
          events/         // Event management
        club/
          tournaments/    // Club's tournament hosting
        coach/
          students/       // Coach dashboard with student performance metrics
        player/
          tournaments/    // Player's registered tournaments view
    (site)/               // Public-facing pages (login, register, home)
  components/
    common/               // Shared: Header, Footer, Navigation
    features/             // Feature-specific components
    ui/                   // Generic UI primitives
  globals.css             // Tailwind setup, CSS variables
```

---

## Important Conventions

### Naming

- **Page components:** `page.tsx` in route directory (Next.js App Router convention)
- **Bracket/Draw terminology:** "Draw" = seeded bracket, "Bracket" = visual representation, "Match" = individual bout
- **Player slots:** "slotA" = traditionally white/top position, "slotB" = blue/bottom position
- **IDs:** Use `matchId` (e.g., `M1_Q_48kg_MALE`) for uniqueness across categories

### Styling

- Tailwind CSS 4; color scheme: Orange primary (`#FF7400`), slate neutrals, emerald/red for status
- Responsive breakpoints used implicitly via Tailwind (no custom media queries usually needed)
- Animations via Framer Motion; avoid setTimeout delays where possible (use transitions instead)

### Component Props

- Use TypeScript interfaces for all component props
- Destructure in function params
- No PropTypes (TypeScript is enforced)

---

## Tournament Draw Generation Algorithm

**IJF Seeding Positions:**

- **S1 (Seed #1):** Top bracket position 0
- **S2 (Seed #2):** Bottom bracket position (N-1)
- **S3 (Seed #3):** Second quarter (N/4)
- **S4 (Seed #4):** Third quarter (3N/4)
- **Unseeded:** Fill remaining slots randomly

**Next-Round Advancement:**

- Match index `i` winner goes to round `r+1`, match index `floor(i/2)`, slot A if `i % 2 === 0`, slot B if `i % 2 === 1`
- Bye matches auto-resolve (non-bye player advances)
- "TBD" slots replaced when opponent confirmed

---

## Recent Work Summary

This session implemented a complete **Match Results & PDF Reporting System**:

1. **Backend (`tournament controller`):**
   - `autoAdvanceWinner()` processes matches and updates next-round slots
   - Integrated into `saveTournamentDraw()` endpoint

2. **Frontend (`tournament [id] page`):**
   - Results & Reports tab with filter, completed match display, next-match info
   - PDF export with professional formatting

3. **Scoreboard Enhancements:**
   - Save Match Result button (explicit confirmation + auto-save backup)
   - Download Report button (window.open with print dialog)
   - Visual feedback (success message, error handling)

4. **Documentation:**
   - `MATCH_RESULTS_FEATURE.md` - Technical deep-dive
   - `SCOREBOARD_SAVE_DOWNLOAD.md` - User guide & implementation details
   - Flow diagrams and UI comparisons

---

## Notes for Future Work

- **Offline capability:** Currently all data lives in API; consider service workers if offline scoreboarding is needed
- **Real-time updates:** BroadcastChannel used for cross-tab comms; consider WebSocket for live bracket updates across multiple admins
- **Performance:** Large tournaments (200+ matches) may need pagination or virtualization in results list
- **Accessibility:** Currently relies on color (emerald/red); consider adding icons or patterns for color-blind users
- **Mobile scoreboarding:** Current UI designed for landscape; portrait mode needs optimization

---

## Debugging Tips

- **Auth issues:** Check `localStorage` for `token`, `userRole`, `userName`
- **API 404s:** Verify backend is running at `NEXT_PUBLIC_API_URL`; check request headers for `Authorization` token
- **Draw not showing:** Confirm `ageGroup`, `gender`, `weightCategory` match filters; verify draw exists in backend
- **Winner not advancing:** Trace `autoAdvanceWinner()` logic; check next-round match exists; verify `winnerId` is set
- **PDF not opening:** Check browser console for errors; fallback to blob URL should trigger if window.open blocked
- **Animations stuttering:** Profile with DevTools; Framer Motion may need `will-change` CSS hints for expensive transforms

---

## Next.js 16 Specifics

- **Breaking changes:** Consult `node_modules/next/dist/docs/` for API changes from prior versions
- **Turbopack:** Default bundler (faster builds); Webpack available via `--webpack` flag in dev
- **Incremental adoption:** Can mix App Router and Pages Router (currently App Router only)
- **Dynamic imports:** Use `next/dynamic` with `ssr: false` for client-only components (Framer Motion overlays)
