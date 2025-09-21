import type { NextConfig } from "next";
import { withNextNetwork } from "next-network";

const nextConfig: NextConfig = withNextNetwork({});

module.exports = nextConfig;
