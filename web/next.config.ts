import type { NextConfig } from 'next';

const config: NextConfig = {
  // The viewer app is a pure client of the NEU TV API: no database, no state
  // of its own. NEUTV_API_BASE points at the gateway; unset means the local
  // dev gateway on :4173.
  env: {
    NEUTV_API_BASE: process.env.NEUTV_API_BASE ?? 'http://localhost:4173',
  },
};

export default config;
