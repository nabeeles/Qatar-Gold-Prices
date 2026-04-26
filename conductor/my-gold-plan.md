# Implementation Plan: My Gold

This plan outlines the technical steps to implement the "My Gold" portfolio tracker in the Qatar Gold Price app.

## Phase 1: Local Storage Foundation
1.  **Install Dependencies:**
    *   `expo-sqlite` for structured local data storage.
    *   `expo-crypto` for UUID generation.
2.  **Database Initialization:**
    *   Created `app/lib/db.ts` using the modern `SQLiteProvider` pattern.
    *   Schema: `id` (TEXT PK), `label` (TEXT), `karat` (INTEGER), `weight` (REAL), `price_per_gram` (REAL), `purchase_date` (TEXT), `created_at` (TEXT).
3.  **CRUD Service:**
    *   Implemented `dbService` with `addEntry`, `getEntries`, and `deleteEntry`.

## Phase 2: Valuation Engine & State
1.  **Market Average Hook:**
    *   Created `useVault` hook to calculate real-time averages from the aggregated provider data.
2.  **State Management:**
    *   Integrated `@tanstack/react-query` to manage the local database state with the `useVault` hook.

## Phase 3: UI Development (Screens & Components)
1.  **"My Gold" Screen:**
    *   Implemented `app/(tabs)/vault.tsx`.
    *   High-fidelity "Hero" summary with live valuation.
    *   Performance-coded `AssetCard` components.
2.  **Add Asset Flow:**
    *   Custom `AddAssetModal` with 18K-24K Karat selector and numeric validation.

## Phase 4: Integration & Stabilization
1.  **Navigation:**
    *   Registered the "My Gold" tab in `app/(tabs)/_layout.tsx` with a `Briefcase` icon.
2.  **Standardization:**
    *   Added 18K support to the `Trends` screen with a Purity Selector.
3.  **Crash Prevention:**
    *   Disabled New Architecture for better native module stability.
    *   Added global error boundaries and try-catch blocks to all data flows.
    *   Fixed asset file extension mismatches (PNG vs JPG).

## Success Criteria
*   Private, local-only data persistence.
*   Live P/L tracking for 18K, 21K, 22K, and 24K holdings.
*   Zero data transmission to external backends for portfolio assets.
