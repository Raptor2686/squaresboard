import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.squaresboard.app',
  appName: 'SquaresBoard',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
