var _a;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5000,
        host: "0.0.0.0",
        allowedHosts: true,
        proxy: {
            "/api": {
                target: (_a = process.env.VITE_PROXY_TARGET) !== null && _a !== void 0 ? _a : "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
});
