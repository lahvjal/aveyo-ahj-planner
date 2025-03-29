# 📍 45 Day Program – AHJ Knock Planner

## 🔥 Project Overview

The AHJ Knock Planner is a map-based tool designed for solar sales reps to quickly identify qualified knocking zones based on known AHJ (Authority Having Jurisdiction) classifications. The goal is to simplify the rep’s workflow by allowing them to:
- View AHJs near their location
- Filter by Class A / B status
- Select and review AHJ details
- Build a custom knock plan based on qualified areas

This aligns directly with the “45 Days to Pay” initiative — ensuring reps are only targeting zones that allow projects to be installed and paid within the 45-day window.

---

## 🎯 Key Features

- 🔍 Filterable AHJ database (by county, zip, class, name)
- 🗺️ Map with dynamic markers showing AHJs from Podio
- 📍 Use current location or input zip/city to center map
- 📏 Adjustable radius to limit AHJs shown on the map
- 🟢 Class A, 🔴 Class B, ⚪ Unknown classification colors
- 🗂️ AHJ info cards with project stats and descriptions
- 📌 Optional “Add to Knock Plan” feature for future phase

---

## 🧰 Tech Stack

### Frontend
- **React** + **Next.js** – modern, performant app structure
- **Tailwind CSS** – styling
- **Mapbox GL JS** – interactive, customizable maps
- **Framer Motion** (optional) – clean animations
- **Zustand** or **Redux** – state management for filters and user plans

### Backend
- **Supabase**
  - Auth (login for reps)
  - PostgreSQL (store AHJ data + saved routes)
  - Storage (optional for future PDF/plan exports)
  - RLS (to secure user data)

### Data & Utilities
- **Podio Exported Dataset** – AHJ locations + classifications
- **GeoJSON or Lat/Lng JSON** – to feed markers on the map
- **Haversine Formula** – for calculating distances
- **Browser Geolocation API** – to use user’s location

---

## 🧠 Data Model (Supabase Example)

### `ahjs`
| Field             | Type       |
|------------------|------------|
| id               | UUID       |
| name             | Text       |
| county           | Text       |
| zip              | Text       |
| classification   | Enum (A/B/None) |
| latitude         | Float      |
| longitude        | Float      |
| created_at       | Timestamp  |

### `knock_plans` (optional for future)
| Field             | Type       |
|------------------|------------|
| id               | UUID       |
| user_id          | UUID (FK)  |
| name             | Text       |
| ahj_ids          | JSON/Array |
| notes            | Text       |
| created_at       | Timestamp  |

---

## 🚀 Development Phases & Execution Plan

### **Phase 1 – MVP (Map + AHJ Filter)**
✅ Goal: Let reps view and filter existing AHJs on a map  
**Duration:** 1–2 weeks

#### Tasks:
- [ ] Scaffold Next.js project w/ Tailwind CSS
- [ ] Set up Supabase project with `ahjs` table
- [ ] Import Podio AHJ data into Supabase
- [ ] Set up Mapbox GL JS on frontend
- [ ] Pull AHJs from Supabase and show markers
- [ ] Add location input + radius filter
- [ ] Filter AHJs within radius using Haversine logic
- [ ] Display classification colors on markers
- [ ] Add click-to-expand info cards
- [ ] Deploy MVP version (Vercel + Supabase)

---

### **Phase 2 – AHJ List View + Detail Sync**
✅ Goal: Add searchable list alongside map, improve UX  
**Duration:** 1 week

#### Tasks:
- [ ] Create AHJ List page with search + filters
- [ ] Sync “View on Map” from list to highlight pin
- [ ] Improve card design (description, project count, etc.)
- [ ] Add pagination and mobile view support

---

### **Phase 3 – Knock Planning Features (Optional)**
✅ Goal: Let reps build and save knock plans  
**Duration:** 1–2 weeks

#### Tasks:
- [ ] Set up `knock_plans` table in Supabase
- [ ] Add “Add to Plan” button on map cards
- [ ] Simple UI to build weekly knock plan
- [ ] Allow notes per zone
- [ ] View, edit, and delete plans
- [ ] Export route plan (optional: PDF or print)

---

### **Phase 4 – Polishing & Admin Panel**
✅ Goal: Final touches + backend tools  
**Duration:** 1 week

#### Tasks:
- [ ] Admin dashboard to classify new AHJs
- [ ] Editable fields (classification, notes)
- [ ] Usage logging (for reps and admins)
- [ ] Style polish, animations, dark/light themes

---

## ✅ Summary

This tool is designed to move fast, get reps productive, and set the foundation for bigger future features. Map filtering based on Podio AHJs keeps complexity down while giving reps the intel they need to win.

