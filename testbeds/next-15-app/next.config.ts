import type { NextConfig } from "next";
import { withNextNetwork } from "next-network-devtools-plugin";

const nextConfig: NextConfig = withNextNetwork({});

module.exports = nextConfig;
