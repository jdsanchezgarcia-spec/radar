# 📁 Carpeta lista para subir a GitHub

Todo lo necesario para que la página de **Radar Materno** quede publicada
como sitio web y funcional.

## Contenido

| Archivo | Qué es |
|---|---|
| `index.html` | Pantalla de inicio de sesión con **Acceder con Google** (raíz del sitio) |
| `app.html` | **Panel completo** (casos, eventos, planes, alertas, visitas, usuarios) |
| `apps-script/` | Código fuente de Google Apps Script (respaldo, no afecta la web) |
| `.nojekyll` | Indica a GitHub Pages que publique los archivos tal cual |

**Flujo:** `index.html` → login con Google → `app.html?ses=TOKEN` → panel.
Ambas páginas hablan con el Web App de Apps Script
(`script.google.com/macros/s/AKfycbx6…/exec`) por `fetch`.

---

## Cómo subirlo (Git Bash)

1. **Instalar Git for Windows** (incluye Git Bash): https://git-scm.com/download/win

2. Abrir **Git Bash** y ejecutar:

```bash
cd "/c/Users/maris/OneDrive/Desktop/danielyjuan/subir a git"

git init
git add .
git commit -m "Radar Materno - página web"

git branch -M main
git remote add origin https://github.com/TU-USUARIO/radar-materno.git
git push -u origin main
```

> Si el repositorio aún no existe, créalo primero en https://github.com/new
> (**Public repository**, sin README ni .gitignore).

3. En GitHub: **Settings → Pages → Source: `main` / carpeta: `/ (root)` → Save**

4. La página queda en:
   `https://TU-USUARIO.github.io/NOMBRE-REPO/`

---

## ⚠️ Pasos obligatorios en Google Cloud

Para que el botón **"Acceder con Google"** funcione en la nueva dirección:

1. Ir a https://console.cloud.google.com/apis/credentials
2. Abrir tu credencial **OAuth 2.0 Client ID**
3. En *Authorized JavaScript origins* → *Add URI* →
   `https://TU-USUARIO.github.io` (sin barra al final)
4. Guardar (tarda ~5 minutos en aplicar)

Si usas un nombre de repo distinto, la URI completa sería
`https://TU-USUARIO.github.io` igualmente (el origen no incluye el repo).

---

## Notas

- El archivo `CONSOLIDADO UA y SEGUIMIENTOS.xlsx` **no está** en esta carpeta
  y no debe subirse nunca (datos personales y de salud).
- El repositorio será **público** (GitHub Pages gratis solo funciona en
  repos públicos): el código de `apps-script/` será visible. Si prefieres
  que sea privado, borra esa carpeta antes de subir.
