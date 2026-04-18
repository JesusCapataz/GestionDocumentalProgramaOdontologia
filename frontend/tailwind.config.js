/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. Aquí le decimos a Tailwind que escanee TODOS los HTML y TS de tu carpeta src
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      // Aquí a futuro podemos centralizar los colores institucionales para todo el proyecto
    },
  },
  plugins: [],
}