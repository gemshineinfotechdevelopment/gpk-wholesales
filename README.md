# GPK Crackers - Wholesales Billing & Management System

**GPK Crackers** is a comprehensive wholesale billing, inventory, and customer ledger management application built with **React (Vite) + TypeScript + Material UI** on the frontend and **Express + TypeScript + MongoDB (Mongoose)** on the backend.

---

## 🔐 Multi-Tier Role-Based Authentication

The platform provides 3 distinct levels of login:

1. **Super Admin (`superadmin`)**:
   - Access to everything across the system.
   - Full visibility into overall business revenue generation metrics:
     - Total Customers
     - Total Debit (Purchases)
     - Total Credit (Paid)
     - Total Pending Due
     - Advance Balances
   - Full editing, deleting, and configuration privileges.

2. **Store Admin (`admin`)**:
   - Manages day-to-day operations: creating orders, customers, particulars, billing, and statements.
   - **Privacy Protection**: Aggregate customer revenue generation cards and financial totals are hidden from admin view.

3. **Customer / User (`user`)**:
   - Dedicated customer portal.
   - Customers log in using their **Mobile Number** or customer name with password.
   - **Strict Privacy**: Customers can **only view their own personal records**:
     - Their personal ledger (debit, credit, advance balance)
     - Their performa invoices and bills (view & print)

---

## 📁 Project Structure

```text
gpk-wholesales/                      # Root Project Directory (Frontend + Monorepo root)
├── index.html                       # Frontend HTML entry point
├── package.json                     # Frontend & Root scripts configuration
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript base config
├── .env                             # Frontend environment variables (VITE_API_URL)
│
├── src/                             # 🎨 FRONTEND SOURCE CODE (React + TS + MUI)
│   ├── assets/                      # Static assets (images, logos, icons)
│   ├── components/                  # React UI components & pages
│   │   ├── AddCompanyPage.tsx
│   │   ├── AddCustomerPage.tsx
│   │   ├── AllCustomersPage.tsx     # Role-aware customer directory & revenue summary
│   │   ├── AllPerformaPage.tsx      # Orders directory (customer filtered for user)
│   │   ├── BillPrintModal.tsx
│   │   ├── BillPrintTemplate.tsx
│   │   ├── CompaniesPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── LoginPage.tsx            # Multi-role login (Super Admin, Admin, Customer)
│   │   ├── Navbar.tsx               # Role-based navigation header
│   │   ├── ParticularsPage.tsx      # Customer ledger & transaction history
│   │   ├── PerformaPage.tsx
│   │   ├── PerformaPrintModal.tsx
│   │   └── ProductsPage.tsx
│   ├── services/                    # API client services
│   ├── utils/                       # Print & WhatsApp helpers
│   ├── App.tsx                      # Root component & routing state
│   └── main.tsx                     # React DOM entry point
│
├── server/                          # 🚀 BACKEND SOURCE CODE (Express + TS)
│   ├── config/                      # Database & Cloudinary configurations
│   ├── controllers/                 # Controllers (authController with 3 roles)
│   ├── models/                      # MongoDB Schemas (Admin, Customer, Performa, etc.)
│   ├── routes/                      # API endpoint routes
│   └── index.ts                     # Express server startup
```

---

## 🚀 Running Locally

```bash
# Start both Frontend & Backend concurrently:
npm run dev:all

# Or run separately:
npm run dev           # Client on http://localhost:5173
npm run dev:server    # Backend API on http://localhost:5004
```
