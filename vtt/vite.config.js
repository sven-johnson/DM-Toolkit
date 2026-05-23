import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                controller: 'index.html',
                player: 'player.html',
            },
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        host: 'localhost',
    },
    // Prevent Vite from obscuring Rust compile errors
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
});
