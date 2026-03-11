import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "os";
import { componentTagger } from "lovable-tagger";

function getNetworkIps(): string[] {
  const result: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) result.push(iface.address);
    }
  }
  return result.length ? result : ['localhost'];
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const rawIp = env.SERVER_IP || '0.0.0.0';
  const detectedIps = getNetworkIps();
  const serverIp = rawIp === '0.0.0.0' ? detectedIps[0] : rawIp;
  const serverPort = env.SERVER_PORT || '5000';
  const displayIps = rawIp === '0.0.0.0' ? detectedIps : [serverIp];

  const G = '\x1b[32m'; const B = '\x1b[1m'; const C = '\x1b[36m'; const R = '\x1b[0m';
  const networkUrlPlugin = {
    name: 'print-network-url',
    configureServer(server: any) {
      // Replace printUrls entirely to avoid WSL virtual IPs appearing
      server.printUrls = () => {
        const port = 8080;
        console.log(`\n  ${G}➜${R}  ${B}Local:${R}       ${C}http://localhost:${port}/${R}`);
        for (const ip of displayIps) {
          console.log(`  ${G}➜${R}  ${B}Network:${R}     ${C}http://${ip}:${port}/${R}`);
        }
        console.log(`  ${G}➜${R}  ${B}Backend API:${R} ${C}http://${serverIp}:${serverPort}/api${R}`);
      };
    },
  };

  return {
  envDir: '../',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(`http://${serverIp}:${serverPort}/api`),
    'import.meta.env.VITE_WS_URL': JSON.stringify(`ws://${serverIp}:${serverPort}`),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: env.VITE_API_URL?.replace('/api', '') || `http://localhost:5000`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), networkUrlPlugin].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize for Raspberry Pi
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  };
});
