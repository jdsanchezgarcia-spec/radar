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

## Usuarios (dos formas)

**A. Registro desde la página (recomendado):**
1. En la página de acceso: **¿No tienes cuenta? Regístrate** → Nombre, correo y contraseña.
2. La cuenta queda **inactiva** (Activo = No). El administrador la activa en la
   hoja **Usuarios** poniendo `Sí` en **Activo** y, si aplica, `Admin` en **Rol**.
3. Con eso el usuario ya puede entrar.

**B. Creación directa en la hoja (con disparador):**
1. Ejecutar **una sola vez** en el editor de Apps Script la función
   **`instalarDisparadorUsuarios`** (desde la hoja: *Extensiones → Apps Script*).
2. En la hoja **Usuarios** escribir: **Email**, **Nombre**, **Rol**
   (`Admin` o `Profesional`) y la contraseña en la columna **`Clave`**
   (el script la cifra en `Sal` + `Hash` y borra lo escrito en claro).
   Volver a escribir en `Clave` equivale a restablecer la contraseña.

Después, desde el panel: **Usuarios → + Agregar usuario** o
**Usuarios → Clave** para restablecerla.

---

## Notas

- El archivo `CONSOLIDADO UA y SEGUIMIENTOS.xlsx` **no está** en esta carpeta
  y no debe subirse nunca (datos personales y de salud).
- El repositorio será **público** (GitHub Pages gratis solo funciona en
  repos públicos): el código de `apps-script/` será visible. Si prefieres
  que sea privado, borra esa carpeta antes de subir.
