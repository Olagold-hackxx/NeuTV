import type { NextConfig } from 'next';

const config: NextConfig = {
  // The press portal is a pure client of the NEU Network API, like the admin
  // and the creators portal: no database, no state of its own.
  env: {
    NEUTV_API_BASE: process.env.NEUTV_API_BASE ?? 'http://localhost:4173',
  },
};

export default config;
