import type { NextConfig } from 'next';

const config: NextConfig = {
  // The admin panel is a pure client of the NEU TV API. It has no database and
  // no state of its own; everything it shows comes from backend/ over the
  // contract, and everything it changes goes back the same way.
  env: {
    NEUTV_API_BASE: process.env.NEUTV_API_BASE ?? 'http://localhost:4173',
  },
};

export default config;
