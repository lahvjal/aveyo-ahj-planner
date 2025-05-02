
# 📝 AHJ Project Browser — Meeting Notes Implementation Plan

## 1. Mask Pre–Scope of Work Projects

### 🧠 Goal:
Prevent reps from seeing sensitive data for projects that haven’t reached the “Scope of Work” milestone.

- Show pin on map but greyed-out  
- Show only basic data (e.g., city, zip)  
- Tooltip: “Project in early phase — restricted info”  

**What’s Required**  
- `milestone` field in `podio_data`
- UI condition: If milestone < "Scope of Work", limit visibility

---

## 2. Add Sales Rep Ownership & Permissions

### 🧠 Goal:
Only the assigned rep should see full data for early-stage projects.

### 🔐 Implementation Plan:
- Add `sales_rep_id` to `podio_data` (from Podio)
- Set up Supabase Auth (email or magic link login)
- Use Row Level Security (RLS) in Supabase:

```sql
-- Allow full view if project is at or past Scope of Work
-- Otherwise, only the assigned rep can view
(policy)
(
  milestone = 'Scope of Work'
  OR
  sales_rep_id = auth.uid()
)
```

---

## 3. Add 45 Day Qualification Filter

### 🧠 Goal:
Allow reps to filter for projects that qualified for the 45 Day Program.

### 🔧 Implementation Plan:
- Add boolean `qualifies_45_day` to `podio_data`
- Add filter options:
  - [ ] All
  - [ ] Qualified
  - [ ] Not Qualified

- Add visual badge/icon for 45 Day status in both views

---

## 🔍 Updated Filter Panel

| Filter Type       | Options               |
|-------------------|------------------------|
| AHJ Classification| All, Class A, Class B  |
| Utility Classification | All, Class A, Class B |
| Financier Classification | All, Class A, Class B |
| 45 Day Qualification | All, Qualified, Not Qualified |

Optional: toggle to show/hide pre-Scope of Work projects (depending on user role)

---
