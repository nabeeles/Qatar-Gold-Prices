# Product Design: My Gold

## 1. Objective
To provide a private, local-only portfolio tracker where users can record their physical gold purchases and monitor their current market value based on live aggregated rates in Qatar.

## 2. User Stories
*   **As a user**, I want to add my gold purchases (weight, karat, price paid) so I can keep a digital record of my assets.
*   **As a user**, I want to see the total current value of my holdings so I know how much my portfolio is worth today.
*   **As a user**, I want to see my unrealized profit or loss per item and in total to understand my investment performance.
*   **As a user**, I want to know that my data is stored only on my device for maximum privacy.

## 3. Data Model (Local Schema)
**`VaultEntry` Object:**
*   `id`: UUID (Primary Key)
*   `label`: String (Optional, e.g., "Wedding Band", "Swiss 10g Bar")
*   `karat`: Enum (18K, 21K, 22K, 24K)
*   `weight`: Float (grams)
*   `pricePerGram`: Float (The purchase price/cost basis)
*   `purchaseDate`: ISO Date String
*   `createdAt`: ISO Date String

## 4. Valuation Logic
*   **Market Average:** Calculated as the mean of all active providers (Al Fardan, Malabar, Joyalukkas, etc.) currently in the system for each karat.
*   **Today's Value:** `Total Weight (per Karat) * Current Market Average (per Karat)`
*   **Unrealized P/L:** `(Current Market Average - Price Per Gram) * Weight`

## 5. UI/UX Requirements
*   **Access:** A new "My Gold" tab in the main navigation.
*   **Hero Dashboard:**
    *   **Total Portfolio Value:** Large, bold gold text.
    *   **Total Gain/Loss:** Percentage and absolute QAR, color-coded (Green for profit, Red for loss).
    *   **Precision Display:** All prices and valuations are formatted to exactly **two decimal places** for professional clarity.
    *   **Note:** "Valuation based on the market average across all providers."
*   **Safe-Entry Modal:**
    *   **Smart-Cost Logic:** Users can enter either the *Price per Gram* or the *Total Price*. The app automatically calculates the other based on the entered weight.
    *   **Native Date Picker:** Intuitive calendar selection for purchase dates (constrained to today or earlier).
    *   **Keyboard Awareness:** The input form automatically shifts to remain visible when the onscreen keyboard is open.
    *   **Intuitive Dismissal:** Supports tapping outside the form to hide the keyboard.
    *   **Scrollable Inputs:** Form content is scrollable to ensure accessibility on all screen sizes.
*   **Entry List:** Scrollable list of cards showing the label, weight, karat, and current performance of each entry.

## 6. Security & Privacy
*   **Local Storage:** All data is stored locally on the device using SQLite.
*   **No Cloud Sync:** Data does not leave the device, ensuring user privacy for sensitive financial holdings.
