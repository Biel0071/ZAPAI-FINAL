# Instructions for Independent Git Repository Setup — skill-global

While `skill-global/` currently lives inside `ZAPAI-FINAL/skill-global/` during initial integration, it is designed to be extracted as a standalone Git repository.

---

## 🚀 Steps to Publish `skill-global` as a Standalone Repository

### 1. Copy `skill-global` folder outside the host project
```bash
cp -r c:/projetos/ZAPAI-FINAL/skill-global c:/projetos/skill-global
cd c:/projetos/skill-global
```

### 2. Initialize Git Repository
```bash
git init
git add .
git commit -m "feat: initial commit of skill-global universal engineering layer"
```

### 3. Connect to GitHub Remote & Push
```bash
git branch -M main
git remote add origin https://github.com/<your-org-or-user>/skill-global.git
git push -u origin main
```

### 4. Publishing to NPM
```bash
npm publish --access public
```
