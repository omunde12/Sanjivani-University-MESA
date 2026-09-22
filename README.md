# Sanjivani University MESA Portal
**Mechanical Engineering Students’ Association (2026–2027)**
Sanjivani University & Sanjivani College of Engineering, Kopargaon

---

## 🚀 One-Click Deployments

### 1. Deploying to Vercel
This project is fully configured for Vercel with Serverless Express support:
1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/sanjivani-mesa.git
   git push -u origin main
   ```
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Keep the default settings (Root Directory `./`, Framework Preset `Other`).
5. Click **Deploy**. Vercel will automatically use `vercel.json` and `api/index.js` to serve both the static portal and all serverless API endpoints!

---

### 2. Deploying to GitHub / GitHub Pages
- **GitHub Repository**: You can push directly to any GitHub repository (`git push -u origin main`).
- **Static Portal (GitHub Pages)**:
  - If hosting on GitHub Pages, the portal includes an automatic dual-layer client-side engine with bundled golden council datasets and `localStorage` persistence.
  - Go to your repository **Settings** -> **Pages** -> Source: `Deploy from branch` -> Branch: `main` / `root` -> **Save**.

---

## 🗄️ Database & Cloud Persistence Options

### Why local JSON files reset in cloud serverless:
In serverless platforms (Vercel, Cloud Run), local disk writes are ephemeral and reset whenever a container restarts or deploys.

### Recommended Permanent Cloud Databases:
1. **Google Cloud SQL (PostgreSQL)**: Fully integrated in AI Studio. When prompted in AI Studio, click to enable Cloud SQL for automated persistent PostgreSQL storage.
2. **Supabase (PostgreSQL)**:
   - Create a free project at [supabase.com](https://supabase.com).
   - In Supabase SQL Editor, run your table schema or store JSON records in the KV table.
   - Set environment variables in Vercel or `.env`:
     - `SUPABASE_URL=https://your-project.supabase.co`
     - `SUPABASE_KEY=your-anon-or-service-key`
3. **Built-in Self-Healing Database & JSON Backups**:
   - The admin panel includes a **Permanent Database & Backup Center** allowing you to download an instant JSON backup (`mesa_database_backup.json`) and restore it on any deployment with 1 click.
