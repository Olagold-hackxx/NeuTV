import type { NextConfig } from 'next';

const config: NextConfig = {
  // The portal is a pure client of the NEU Network API, exactly like the
  // admin: no database, no state of its own.
  env: {
    NEUTV_API_BASE: process.env.NEUTV_API_BASE ?? 'http://localhost:4173',
  },
};

export default config;
