# 🎮 Pixel Quest: The Access Chronicles

> A real-time multiplayer trivia game for CSE3200 Seminar 5  
> **Topic: Educational Access & Skill Development in Computer Graphics**

---

## 📋 What This Is

A browser-based multiplayer quiz game where:
- **Students** open a link in their browser, pick a pixel character, and answer 5 live trivia questions about educational access in computer graphics
- **You (admin)** see a live dashboard showing who's online, who answered what, and the real-time leaderboard
- Everything resets cleanly so you can replay if needed

---

## 🚀 Getting It Live (Step-by-Step)

You need two things: **GitHub** (stores the code) + **Render** (runs the game). Both are free. Follow every step exactly.

---

### PART 1 — Put the code on GitHub

**Step 1.** Go to [github.com](https://github.com) and sign in to your account (`Zenie1`).

**Step 2.** Click the **+** button (top right) → **New repository**

**Step 3.** Fill in:
- Repository name: `pixel-quest`
- Description: `CSE3200 Seminar 5 mini-game`
- Set to **Public**
- ❌ Do NOT tick "Add a README" (we already have one)
- Click **Create repository**

**Step 4.** GitHub will show you a page with setup commands. You need to upload the files. The easiest way:

#### Option A — GitHub Desktop (Recommended if you're not comfortable with terminal)
1. Download [GitHub Desktop](https://desktop.github.com/) and install it
2. Sign in with your GitHub account
3. Click **File → Add Local Repository**
4. Browse to the `pixel-quest` folder on your computer → click **Add**
5. It will say "This folder has no Git repository" → click **Create a Repository**
6. Click **Publish repository** → make sure "Keep this code private" is **unchecked** → Publish

#### Option B — Terminal / Git Bash
```bash
cd path/to/pixel-quest
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Zenie1/pixel-quest.git
git push -u origin main
```

**Step 5.** Refresh your GitHub page. You should see all the files listed. ✅

---

### PART 2 — Deploy on Render (makes it accessible to everyone)

**Step 1.** Go to [render.com](https://render.com) → click **Get Started for Free**

**Step 2.** Sign up using **GitHub** (click "Sign up with GitHub" — this links the two accounts automatically)

**Step 3.** Once logged in, click **New +** → **Web Service**

**Step 4.** You'll see a list of your GitHub repos. Click **Connect** next to `pixel-quest`

**Step 5.** Fill in the settings:
| Field | Value |
|-------|-------|
| Name | `pixel-quest` |
| Region | Choose closest to you |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

**Step 6.** Click **Create Web Service**

**Step 7.** Render will build and deploy the app. This takes about 2–4 minutes. Watch the log at the bottom — when you see `🎮 Pixel Quest running on port...` it's ready. ✅

**Step 8.** At the top of the page you'll see your URL — it looks like:
```
https://pixel-quest-xxxx.onrender.com
```
Copy this URL. **This is the link you share in Zoom.**

---

### PART 3 — Test It Before the Seminar

1. Open the game URL in your browser — you should see the character selection screen
2. Open a second tab and go to: `https://pixel-quest-xxxx.onrender.com/admin.html`
3. Enter password: `Seminar5`
4. You should see the admin dashboard
5. In your first tab, join with a test name → watch yourself appear in the admin dashboard instantly
6. Click **Start Game** in the admin → the question should appear in the player tab
7. Answer it → watch the bar chart update in real time

---

## 🎮 How to Run the Game During Your Seminar

### Before you present:
1. Open the admin dashboard: `https://your-url.onrender.com/admin.html`
2. Password: `Seminar5`
3. Paste the base URL in the Zoom chat

### During the game:
| You do | What happens |
|--------|-------------|
| Students open the link | They appear in your player list instantly |
| You click **▶ START GAME** | A 3-second countdown appears on all screens, then Q1 appears |
| Students answer | Bar charts update live. You see ✅/❌ next to each player |
| Time runs out (20s) | Results automatically show on all screens |
| You click **⏭ NEXT QUESTION** | Q2 appears |
| After Q5 | Final leaderboard shown to everyone |
| You click **↺ RESET** | Clears everything for a second round |

### Scoring:
- Correct answer: **100 points**
- Speed bonus: up to **+100 extra points** for answering fast
- Wrong answer: **0 points**

---

## 📁 File Structure

```
pixel-quest/
├── server.js           ← Backend: game logic, real-time events
├── package.json        ← Dependencies
├── .gitignore
├── README.md
└── public/
    ├── index.html      ← Player page (the link you share)
    ├── admin.html      ← Your dashboard (/admin.html)
    ├── style.css       ← All styling
    ├── game.js         ← Player browser logic
    └── admin.js        ← Admin browser logic
```

---

## ❓ Troubleshooting

**"The link doesn't load"**  
→ Render free tier can "sleep" after inactivity. Open it yourself first to wake it up (takes ~30 seconds), then share the link.

**"I can't see players joining"**  
→ Make sure you're on `/admin.html` and logged in. Check the Activity Log at the bottom.

**"Game already started — student can't join"**  
→ Students must join BEFORE you click Start Game. Use Reset to start fresh.

**"I need to change a question"**  
→ Open `server.js`, find the `QUESTIONS` array near the top, edit the text, save, re-push to GitHub. Render auto-deploys within 1–2 minutes.

**"The free Render URL has a different domain"**  
→ That's normal. Copy whatever URL Render gives you.

---

## 🧠 The 5 Questions (for reference)

| # | Question | Correct Answer |
|---|----------|----------------|
| 1 | Which is a FREE open-source 3D modeling tool? | Blender |
| 2 | MOOC dropout rates exceed...? | 90% |
| 3 | Which platform hosts 200,000+ design courses? | Udemy |
| 4 | What barrier stops most people in developing regions? | Hardware & internet costs |
| 5 | The Blender Artists forum has how many members? | 5 Million+ |

---

## 📚 References

- Blender Foundation. (2024). *Blender community statistics.* https://www.blender.org/foundation/
- Reich, J., & Ruipérez-Valiente, J. A. (2019). The MOOC pivot. *Science, 363*(6423), 130–131. https://doi.org/10.1126/science.aav7958
- Udemy. (2024). *Udemy platform overview.* https://about.udemy.com
- UNESCO. (2023). *Global education monitoring report 2023.* https://en.unesco.org/gem-report/2023

---

*Built for CSE3200 — The Accessibility of Creation, Group 5, Seminar 5*
