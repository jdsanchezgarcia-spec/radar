# 📁 Carpeta lista para subir a GitHub

Todo lo necesario para que la página de **Radar Materno** quede publicada
como sitio web y funcional.

## Contenido

| Archivo | Qué es |
|---|---|
| `index.html` | Pantalla de acceso con **usuario y contraseña** (raíz del sitio) |
| `app.html` | **Panel completo** (casos, eventos, planes, alertas, visitas, usuarios) |
| `apps-script/` | Código fuente de Google Apps Script (respaldo, no afecta la web) |
| `.nojekyll` | Indica a GitHub Pages que publique los archivos tal cual |

**Flujo:** `index.html` (usuario + contraseña) → `app.html?ses=TOKEN` → panel.
Ambas páginas hablan con el Web App de Apps Script
(`script.google.com/macros/s/AKfycbx6…/exec`) por `fetch`.

> 🔑 Las contraseñas se guardan en la hoja `Usuarios` como **hash SHA-256 + sal**
> (nunca en claro). El administrador las crea desde el panel: *Usuarios → Clave*.

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

## Pasos en Google (solo la primera vez)

1. Abrir el editor de Apps Script y ejecutar **una sola vez**
   desde el selector de funciones:

   ```
   asignarClaveInicial('tu-correo@unillanos.edu.co', 'TuClave123')
   ```

   Eso crea la contraseña del **primer administrador**.
2. Entrar a la página con ese usuario y contraseña.
3. Desde el panel: **Usuarios → + Agregar usuario** (ahí se define la
   contraseña de cada profesional) o **Usuarios → Clave** para restablecerla.

---

## Notas

- El archivo `CONSOLIDADO UA y SEGUIMIENTOS.xlsx` **no está** en esta carpeta
  y no debe subirse nunca (datos personales y de salud).
- El repositorio será **público** (GitHub Pages gratis solo funciona en
  repos públicos): el código de `apps-script/` será visible. Si prefieres
  que sea privado, borra esa carpeta antes de subir.
